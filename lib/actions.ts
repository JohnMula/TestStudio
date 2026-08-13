'use server'

import { createServiceClient, createClient } from '@/lib/supabase/server'
import {
  gradeQuestion,
  makeCode,
  normalizeQuestions,
  QUESTION_TYPES,
  seededShuffle,
  toPublicQuestion,
  validateCreateTestInput,
  type CreateTestInput,
  type AttemptDetail,
  type DraftData,
  type PublicTest,
  type Question,
  type ResultQuestionReview,
  type Response,
  type Test,
  type TestAttempt,
  type TestDraft,
  type TestResult,
  type TestSnapshot,
} from '@/lib/types'
import {
  rateLimitCreateTest,
  rateLimitSubmitResponse,
  rateLimitCodeLookup,
  getClientIp,
} from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'

/* ============================================================
   Row <-> domain mapping

   DB columns are snake_case with timestamptz dates; the UI works
   in camelCase with epoch-millisecond numbers. These helpers keep
   the boundary in one place.
   ============================================================ */

type TestRow = {
  id: string
  title: string
  code: string
  time_limit: string
  shuffle: boolean
  shuffle_choices: boolean | null
  single_attempt: boolean
  opens_at: string | null
  closes_at: string | null
  questions: Question[]
  created_at: string
}

type ResponseRow = {
  id: string
  test_id: string
  taker_name: string
  answers: Record<string, unknown>
  auto_earned: number
  auto_possible: number
  manual_scores: Record<string, number>
  needs_grading: boolean
  submitted_at: string
  test_snapshot: TestSnapshot | null
  taker_id?: string | null
  attempt_number?: number | null
}

type DraftRow = {
  id: string
  title: string
  question_type: string
  draft_data: DraftData
  created_at: string
  updated_at: string
}

type PublicAttemptTestRow = {
  id: string
  code: string
  single_attempt: boolean
}

function ms(value: string | null): number | null {
  return value ? new Date(value).getTime() : null
}

/* Server actions are also called by anonymous visitors, but account-owned
   drafts and history must never silently become anonymous data.  Keep this
   check next to the server client boundary so every action has the same
   definition of a signed-in TestStudio account. */
async function getAuthenticatedClient() {
  const db = await createClient()
  const { data, error } = await db.auth.getUser()
  const user = data.user
  if (error || !user || user.is_anonymous) return { db, user: null }
  return { db, user }
}

function mapResponse(row: ResponseRow): Response {
  return {
    id: row.id,
    takerName: row.taker_name,
    submittedAt: new Date(row.submitted_at).getTime(),
    answers: row.answers ?? {},
    autoEarned: row.auto_earned,
    autoPossible: row.auto_possible,
    manualScores: row.manual_scores ?? {},
    needsGrading: row.needs_grading,
    testSnapshot: row.test_snapshot ?? undefined,
  }
}

function mapTest(row: TestRow, responses: ResponseRow[]): Test {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    timeLimit: row.time_limit,
    shuffle: row.shuffle,
    shuffleChoices: row.shuffle_choices ?? true,
    singleAttempt: row.single_attempt,
    createdAt: new Date(row.created_at).getTime(),
    questions: normalizeQuestions(row.questions),
    responses: responses
      .map(mapResponse)
      .sort((a, b) => b.submittedAt - a.submittedAt),
    opensAt: ms(row.opens_at),
    closesAt: ms(row.closes_at),
  }
}

function toTestSnapshot(row: TestRow): TestSnapshot {
  return {
    title: row.title,
    code: row.code,
    timeLimit: row.time_limit,
    shuffle: row.shuffle,
    shuffleChoices: row.shuffle_choices ?? true,
    singleAttempt: row.single_attempt,
    opensAt: ms(row.opens_at),
    closesAt: ms(row.closes_at),
    questions: normalizeQuestions(row.questions),
  }
}

/* ============================================================
   Post-submission result formatting

   The helpers below run only inside submitResponse(), where the private
   question definition is available. Their output is display-ready rather
   than a copy of the answer key, and is returned only after the response
   insert succeeds.
   ============================================================ */

const NO_ANSWER = 'No answer submitted'
const NO_CORRECT_ANSWER = 'No correct answer configured'

function answerText(value: unknown, fallback = NO_ANSWER): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function answerArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => answerText(item)) : []
}

function optionLabel(
  options: Extract<Question, { type: 'multiple_choice' }>['options'],
  index: number,
): string {
  const letter = String.fromCharCode(65 + index)
  const text = options[index]?.text
  return `${letter}. ${text?.trim() ? text : '—'}`
}

function selectedOptions(q: Extract<Question, { type: 'multiple_choice' }>, answer: unknown): string[] {
  const optionIndexes = new Map(q.options.map((option, index) => [option.id, index]))
  const indexes = Array.isArray(answer)
    ? answer.flatMap((value) => {
        if (typeof value === 'string') {
          const index = optionIndexes.get(value)
          return index === undefined ? [] : [index]
        }
        // Supports result rendering for a response submitted before choice
        // IDs were added. New submissions send only string option IDs.
        return typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 0 &&
          value < q.options.length
          ? [value]
          : []
      })
    : []
  const unique = [...new Set(indexes)].sort((a, b) => a - b)
  return unique.length > 0 ? unique.map((index) => optionLabel(q.options, index)) : [NO_ANSWER]
}

function matchingLines(q: Extract<Question, { type: 'matching' }>, answer: unknown): string[] {
  if (q.pairs.length === 0) return [NO_ANSWER]

  const submitted =
    answer && typeof answer === 'object' && !Array.isArray(answer)
      ? (answer as Record<string, unknown>)
      : {}
  const rightByKey = new Map(
    seededShuffle(q.pairs, `${q.id}:rights`).map((pair, index) => [
      `r${index}`,
      pair.right,
    ]),
  )

  return q.pairs.map((pair) => {
    const rightKey = submitted[pair.id]
    const right = typeof rightKey === 'string' ? rightByKey.get(rightKey) : undefined
    return `${answerText(pair.left, '—')} → ${answerText(right)}`
  })
}

function correctMatchingLines(q: Extract<Question, { type: 'matching' }>): string[] {
  return q.pairs.length > 0
    ? q.pairs.map(
        (pair) =>
          `${answerText(pair.left, '—')} → ${answerText(pair.right, NO_CORRECT_ANSWER)}`,
      )
    : [NO_CORRECT_ANSWER]
}

function submittedAnswerLines(q: Question, answer: unknown): string[] {
  switch (q.type) {
    case 'multiple_choice':
      return selectedOptions(q, answer)
    case 'true_false':
      return answer === true ? ['True'] : answer === false ? ['False'] : [NO_ANSWER]
    case 'identification':
    case 'essay':
      return [answerText(answer)]
    case 'matching':
      return matchingLines(q, answer)
    case 'fill_blank': {
      const answers = answerArray(answer)
      return q.blanks.length > 0
        ? q.blanks.map((_, index) => `Blank ${index + 1}: ${answers[index] ?? NO_ANSWER}`)
        : [NO_ANSWER]
    }
    case 'enumeration': {
      const answers = answerArray(answer)
      return q.answers.length > 0
        ? q.answers.map((_, index) => `${index + 1}. ${answers[index] ?? NO_ANSWER}`)
        : [NO_ANSWER]
    }
  }
}

function correctAnswerLines(q: Exclude<Question, { type: 'essay' }>): string[] {
  switch (q.type) {
    case 'multiple_choice':
      return q.correct.length > 0
        ? q.correct.flatMap((id) => {
            const index = q.options.findIndex((option) => option.id === id)
            return index < 0 ? [] : [optionLabel(q.options, index)]
          })
        : [NO_CORRECT_ANSWER]
    case 'true_false':
      return [q.answer ? 'True' : 'False']
    case 'identification':
      return [answerText(q.answer, NO_CORRECT_ANSWER)]
    case 'matching':
      return correctMatchingLines(q)
    case 'fill_blank':
      return q.blanks.length > 0
        ? q.blanks.map(
            (blank, index) =>
              `Blank ${index + 1}: ${answerText(blank.answers[0], NO_CORRECT_ANSWER)}`,
          )
        : [NO_CORRECT_ANSWER]
    case 'enumeration':
      return q.answers.length > 0
        ? q.answers.map(
            (value, index) => `${index + 1}. ${answerText(value, NO_CORRECT_ANSWER)}`,
          )
        : [NO_CORRECT_ANSWER]
  }
}

function buildTestResult(
  questions: Question[],
  rawAnswers: Record<string, unknown>,
  scoreEarned: number,
  manualScores: Record<string, number> = {},
): TestResult {
  let correctCount = 0
  let incorrectCount = 0
  let manualGradingCount = 0
  const totalPossible = questions.reduce((sum, question) => sum + question.points, 0)

  const resultQuestions: ResultQuestionReview[] = questions.map((question) => {
    const grade = gradeQuestion(question, rawAnswers[question.id])
    const status = !grade.auto
      ? 'manual'
      : grade.correct
        ? 'correct'
        : 'incorrect'

    if (status === 'correct') correctCount += 1
    if (status === 'incorrect') incorrectCount += 1
    if (status === 'manual') manualGradingCount += 1

    return {
      questionId: question.id,
      type: question.type,
      prompt: question.prompt,
      submittedAnswer: submittedAnswerLines(question, rawAnswers[question.id]),
      ...(question.type === 'essay'
        ? {}
        : { correctAnswer: correctAnswerLines(question) }),
      ...(question.explanation?.trim()
        ? { explanation: question.explanation.trim() }
        : {}),
      status,
      pointsEarned: grade.auto
        ? grade.earned
        : Math.max(0, Math.min(question.points, manualScores[question.id] ?? 0)),
      pointsPossible: question.points,
    }
  })

  return {
    scoreEarned,
    totalPossible,
    percentage:
      totalPossible > 0 ? Math.round((scoreEarned / totalPossible) * 100) : 0,
    correctCount,
    incorrectCount,
    manualGradingCount,
    needsGrading: manualGradingCount > 0,
    questions: resultQuestions,
  }
}

function mapDraft(row: DraftRow): TestDraft {
  const data = row.draft_data ?? ({} as DraftData)
  const questions = normalizeQuestions(data.questions)
  const fallbackType = questions[questions.length - 1]?.type ?? 'multiple_choice'
  const questionType = QUESTION_TYPES.some((item) => item.type === data.questionType)
    ? data.questionType
    : fallbackType
  return {
    id: row.id,
    title: typeof data.title === 'string' ? data.title : row.title ?? '',
    code: typeof data.code === 'string' ? data.code : '',
    timeLimit: typeof data.timeLimit === 'string' ? data.timeLimit : '15m',
    shuffle: data.shuffle ?? true,
    shuffleChoices: data.shuffleChoices ?? true,
    singleAttempt: data.singleAttempt ?? false,
    questionType,
    questions,
    opensAt: typeof data.opensAt === 'number' ? data.opensAt : null,
    closesAt: typeof data.closesAt === 'number' ? data.closesAt : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function validateDraftData(input: DraftData): string | null {
  if (!input || typeof input !== 'object') return 'The draft data is invalid.'
  if (typeof input.title !== 'string' || input.title.length > 200) {
    return 'Draft title is too long.'
  }
  if (!Array.isArray(input.questions) || input.questions.length > 200) {
    return 'A draft can contain up to 200 questions.'
  }
  if (!QUESTION_TYPES.some((item) => item.type === input.questionType)) {
    return 'The draft question type is invalid.'
  }
  // The generous cap keeps autosave useful for unfinished questions while
  // still protecting the JSONB column from accidental megabyte-scale input.
  if (JSON.stringify(input).length > 1_000_000) {
    return 'This draft is too large to save.'
  }
  return null
}

function scoreForResponse(response: ResponseRow): number {
  const manual = Object.values(response.manual_scores ?? {}).reduce(
    (total, value) => total + (typeof value === 'number' ? value : 0),
    0,
  )
  return (response.auto_earned ?? 0) + manual
}

/* ============================================================
   Reads
   ============================================================ */

/* RLS-scoped ("tests_select_own"): only returns tests owned by this
   browser's anonymous auth user. */
export async function listTests(): Promise<Test[]> {
  const db = await createClient()
  const { data: tests, error } = await db
    .from('tests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const rows = (tests ?? []) as TestRow[]
  if (rows.length === 0) return []

  const { data: responses, error: rErr } = await db
    .from('responses')
    .select('*')
    .in(
      'test_id',
      rows.map((t) => t.id),
    )
  if (rErr) throw new Error(rErr.message)

  const byTest = new Map<string, ResponseRow[]>()
  for (const r of (responses ?? []) as ResponseRow[]) {
    const list = byTest.get(r.test_id) ?? []
    list.push(r)
    byTest.set(r.test_id, list)
  }

  return rows.map((t) => mapTest(t, byTest.get(t.id) ?? []))
}

/* RLS-scoped, same as listTests — resolves to null if this id
   doesn't exist OR belongs to a different anonymous identity. */
export async function getTest(id: string): Promise<Test | null> {
  const db = await createClient()
  const { data: test, error } = await db
    .from('tests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!test) return null

  const { data: responses, error: rErr } = await db
    .from('responses')
    .select('*')
    .eq('test_id', id)
  if (rErr) throw new Error(rErr.message)

  return mapTest(test as TestRow, (responses ?? []) as ResponseRow[])
}

/* ============================================================
   Account-backed drafts

   Draft rows are deliberately separate from published tests.  That lets an
   unfinished editor state survive across devices without making incomplete
   tests public or polluting the creator's published-test list.
   ============================================================ */

export type SaveDraftResult =
  | { ok: true; draft: TestDraft }
  | { ok: false; error: string; needsSignIn?: boolean }

export async function listDrafts(): Promise<TestDraft[]> {
  const { db, user } = await getAuthenticatedClient()
  if (!user) return []

  const { data, error } = await db
    .from('drafts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as DraftRow[]).map(mapDraft)
}

export async function getDraft(id: string): Promise<TestDraft | null> {
  if (!id) return null
  const { db, user } = await getAuthenticatedClient()
  if (!user) return null

  const { data, error } = await db
    .from('drafts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDraft(data as DraftRow) : null
}

export async function saveServerDraft(
  id: string | null,
  input: DraftData,
): Promise<SaveDraftResult> {
  const validationError = validateDraftData(input)
  if (validationError) return { ok: false, error: validationError }

  const { db, user } = await getAuthenticatedClient()
  if (!user) {
    return {
      ok: false,
      needsSignIn: true,
      error: 'Sign in to save drafts to your account.',
    }
  }

  const payload = {
    title: input.title.trim() || 'Untitled test',
    question_type: input.questionType,
    draft_data: input,
  }

  if (id) {
    const { data, error } = await db
      .from('drafts')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (data) return { ok: true, draft: mapDraft(data as DraftRow) }
    if (error) {
      return {
        ok: false,
        error: 'Unable to save this draft. Please try again.',
      }
    }

    // A browser creates its UUID before the first debounce fires. If two
    // overlapping autosaves arrive before the row exists, they both carry
    // that same id, so this insert path can never create duplicate drafts.
    const { data: inserted, error: insertError } = await db
      .from('drafts')
      .insert({ ...payload, id, owner_id: user.id })
      .select('*')
      .single()
    if (inserted) return { ok: true, draft: mapDraft(inserted as DraftRow) }
    if (insertError?.code === '23505') {
      const { data: concurrent } = await db
        .from('drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (concurrent) return { ok: true, draft: mapDraft(concurrent as DraftRow) }
    }
    return { ok: false, error: 'Unable to create this draft. Please try again.' }
  }

  const { data, error } = await db
    .from('drafts')
    .insert({ ...payload, owner_id: user.id })
    .select('*')
    .single()
  if (error) {
    return { ok: false, error: 'Unable to create this draft. Please try again.' }
  }
  return { ok: true, draft: mapDraft(data as DraftRow) }
}

export type DeleteDraftResult = { ok: true } | { ok: false; error: string }

export async function deleteDraft(id: string): Promise<DeleteDraftResult> {
  const { db, user } = await getAuthenticatedClient()
  if (!user) return { ok: false, error: 'Sign in to manage your drafts.' }

  const { data, error } = await db
    .from('drafts')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error || !data) {
    return { ok: false, error: 'Unable to delete this draft. Please try again.' }
  }
  return { ok: true }
}

/* ============================================================
   Account test history

   A response gets a taker_id only when the current auth session is a real
   account.  Anonymous/public submissions still work exactly as before, but
   signed-in takers can retrieve only their own immutable response snapshot.
   ============================================================ */

async function currentTestsForAttempts(testIds: string[]) {
  if (testIds.length === 0) return new Map<string, PublicAttemptTestRow>()
  const { data, error } = await createServiceClient()
    .from('tests')
    .select('id, code, single_attempt')
    .in('id', testIds)
  if (error) throw new Error(error.message)
  return new Map(
    ((data ?? []) as PublicAttemptTestRow[]).map((test) => [test.id, test]),
  )
}

function mapAttempt(
  row: ResponseRow,
  current: PublicAttemptTestRow | undefined,
): TestAttempt | null {
  const snapshot = row.test_snapshot
  if (!snapshot?.questions) return null
  const questions = normalizeQuestions(snapshot.questions)
  const totalPossible = questions.reduce((sum, question) => sum + question.points, 0)
  const scoreEarned = scoreForResponse(row)
  return {
    id: row.id,
    testId: row.test_id,
    title: snapshot.title || 'Untitled test',
    code: snapshot.code || current?.code || '',
    takerName: row.taker_name,
    attemptNumber: row.attempt_number ?? 1,
    submittedAt: new Date(row.submitted_at).getTime(),
    scoreEarned,
    totalPossible,
    percentage: totalPossible > 0 ? Math.round((scoreEarned / totalPossible) * 100) : 0,
    needsGrading: row.needs_grading,
    singleAttempt: current?.single_attempt ?? snapshot.singleAttempt,
    canRetake: Boolean(current && !current.single_attempt),
    ...(current && !current.single_attempt ? { retakeCode: current.code } : {}),
  }
}

export async function listTakenTests(): Promise<TestAttempt[]> {
  const { db, user } = await getAuthenticatedClient()
  if (!user) return []

  const { data, error } = await db
    .from('responses')
    .select('*')
    .eq('taker_id', user.id)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as ResponseRow[]
  const currentTests = await currentTestsForAttempts(
    [...new Set(rows.map((row) => row.test_id))],
  )
  return rows.flatMap((row) => {
    const attempt = mapAttempt(row, currentTests.get(row.test_id))
    return attempt ? [attempt] : []
  })
}

export async function getAttempt(id: string): Promise<AttemptDetail | null> {
  if (!id) return null
  const { db, user } = await getAuthenticatedClient()
  if (!user) return null

  const { data, error } = await db
    .from('responses')
    .select('*')
    .eq('id', id)
    .eq('taker_id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as ResponseRow
  const currentTests = await currentTestsForAttempts([row.test_id])
  const attempt = mapAttempt(row, currentTests.get(row.test_id))
  const snapshot = row.test_snapshot
  if (!attempt || !snapshot) return null

  const result = buildTestResult(
    normalizeQuestions(snapshot.questions),
    row.answers ?? {},
    scoreForResponse(row),
    row.manual_scores ?? {},
  )
  return { ...attempt, result }
}

/* Answer-free payload for test-takers. Correct answers, alternates,
   and matching pairings are stripped server-side and never sent.
   Deliberately still on the service-role client: taking a test never
   requires an account, and there's no "owner" concept for a taker.

   Rate-limited (per ip) since this is the code-guessing surface — and
   uses an exact .eq() on the normalized code rather than .ilike(),
   since % and _ are unescaped wildcards in Postgres LIKE/ILIKE and
   codes are meant to match exactly or not at all. Returns null (same
   as "not found") when rate-limited, so callers need no new handling. */
export async function getPublicTestByCode(
  code: string,
): Promise<PublicTest | null> {
  const limited = await rateLimitCodeLookup()
  if (!limited.allowed) return null

  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  const db = createServiceClient()
  const { data: test, error } = await db
    .from('tests')
    .select('*')
    .eq('code', normalized)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!test) return null

  const row = test as TestRow
  const questions = normalizeQuestions(row.questions)
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    timeLimit: row.time_limit,
    shuffle: row.shuffle,
    shuffleChoices: row.shuffle_choices ?? true,
    singleAttempt: row.single_attempt,
    opensAt: ms(row.opens_at),
    closesAt: ms(row.closes_at),
    questions: questions.map((question) =>
      toPublicQuestion(question, row.shuffle_choices ?? true),
    ),
  }
}

/* ============================================================
   Writes
   ============================================================ */

/* Deliberately on the service-role client, not the per-user one:
   test codes have to be unique across every owner, not just the
   current browser's own tests, so this needs to see every row.
   Exact match on the normalized code, same reasoning as
   getPublicTestByCode — .ilike() left % and _ unescaped. */
async function codeExists(code: string, exceptId?: string): Promise<boolean> {
  const db = createServiceClient()
  let query = db.from('tests').select('id').eq('code', code.trim().toUpperCase())
  if (exceptId) query = query.neq('id', exceptId)
  const { data, error } = await query.limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

export type CreateTestResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export type UpdateTestResult = CreateTestResult

export async function createTest(
  input: CreateTestInput,
): Promise<CreateTestResult> {
  const limited = await rateLimitCreateTest()
  if (!limited.allowed) return { ok: false, error: limited.error }

  const validationError = validateCreateTestInput(input)
  if (validationError) return { ok: false, error: validationError }

  const db = await createClient()

  let code = input.code?.trim().toUpperCase() || ''
  if (code) {
    if (await codeExists(code)) {
      return { ok: false, error: 'That code is already taken.' }
    }
  } else {
    code = makeCode()
    while (await codeExists(code)) code = makeCode()
  }

  // owner_id isn't set explicitly — it defaults to auth.uid() at the
  // database level (see the SQL migration), which is this browser's
  // anonymous auth user.
  const { data, error } = await db
    .from('tests')
    .insert({
      title: input.title,
      code,
      time_limit: input.timeLimit,
      shuffle: input.shuffle,
      shuffle_choices: input.shuffleChoices,
      single_attempt: input.singleAttempt,
      opens_at: input.opensAt ? new Date(input.opensAt).toISOString() : null,
      closes_at: input.closesAt ? new Date(input.closesAt).toISOString() : null,
      questions: input.questions,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

/* Updates go through the RLS-scoped client so a browser can only update a
   test it owns. The existing row is read first both to verify ownership and
   to preserve its current share code when no replacement was supplied. */
export async function updateTest(
  id: string,
  input: CreateTestInput,
): Promise<UpdateTestResult> {
  const validationError = validateCreateTestInput(input)
  if (validationError) return { ok: false, error: validationError }

  const db = await createClient()
  const { data: existing, error: readError } = await db
    .from('tests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (readError || !existing) {
    return {
      ok: false,
      error: 'This test could not be found or you no longer have permission to edit it.',
    }
  }

  const current = existing as TestRow
  const code = input.code?.trim().toUpperCase() || current.code
  if (await codeExists(code, id)) {
    return { ok: false, error: 'That code is already taken.' }
  }

  // Responses created before this feature do not yet have a snapshot. Capture
  // the current version before replacing it, so their original score and
  // question context cannot drift after the edit.
  const { error: snapshotError } = await createServiceClient()
    .from('responses')
    .update({ test_snapshot: toTestSnapshot(current) })
    .eq('test_id', id)
    .is('test_snapshot', null)
  if (snapshotError) {
    return {
      ok: false,
      error: 'Unable to preserve this test’s response history. Please try again.',
    }
  }

  const { data, error } = await db
    .from('tests')
    .update({
      title: input.title,
      code,
      time_limit: input.timeLimit,
      shuffle: input.shuffle,
      shuffle_choices: input.shuffleChoices,
      single_attempt: input.singleAttempt,
      opens_at: input.opensAt ? new Date(input.opensAt).toISOString() : null,
      closes_at: input.closesAt ? new Date(input.closesAt).toISOString() : null,
      questions: input.questions,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return {
      ok: false,
      error: 'Unable to save your changes. Please try again.',
    }
  }
  return { ok: true, id: (data as { id: string }).id }
}

export type DeleteTestResult = { ok: true } | { ok: false; error: string }

/* RLS ("tests_delete_own") makes an unauthorized delete a no-op. Request the
   deleted id back so callers can distinguish that outcome from a successful
   deletion and keep the confirmation dialog open with a useful error. */
export async function deleteTest(id: string): Promise<DeleteTestResult> {
  const db = await createClient()
  const { data, error } = await db
    .from('tests')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) {
    return {
      ok: false,
      error: 'Unable to delete this test. Please try again.',
    }
  }
  if (!data) {
    return {
      ok: false,
      error: 'This test was not found or you no longer have permission to delete it.',
    }
  }
  return { ok: true }
}

export async function duplicateTest(id: string): Promise<{ id: string } | null> {
  const db = await createClient()
  // RLS ("tests_select_own") means this SELECT only succeeds for a
  // test this browser owns — a stranger's test id resolves to null.
  const { data: src, error } = await db
    .from('tests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!src) return null

  const row = src as TestRow
  let code = makeCode()
  while (await codeExists(code)) code = makeCode()

  // Same as createTest: owner_id defaults to auth.uid(), so the copy
  // belongs to whoever duplicated it.
  const { data, error: insErr } = await db
    .from('tests')
    .insert({
      title: `${row.title} (copy)`,
      code,
      time_limit: row.time_limit,
      shuffle: row.shuffle,
      shuffle_choices: row.shuffle_choices ?? true,
      single_attempt: row.single_attempt,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
      questions: normalizeQuestions(row.questions),
    })
    .select('id')
    .single()
  if (insErr) throw new Error(insErr.message)
  return { id: (data as { id: string }).id }
}

export type SubmitResult =
  | {
      ok: true
      result: TestResult
      responseId: string
    }
  | { ok: false; error: string }

/* Grading happens here, on the server, using the full (private)
   question definitions — the taker's browser never sees the key.
   Stays on the service-role client, same as before: submitting a
   response never requires an account or ownership of the test. */
export async function submitResponse(
  testId: string,
  rawAnswers: Record<string, unknown>,
  takerName: string,
  captchaToken: string,
  deviceId: string,
): Promise<SubmitResult> {
  const limited = await rateLimitSubmitResponse(testId)
  if (!limited.allowed) return { ok: false, error: limited.error }

  const ip = await getClientIp()
  const verified = await verifyTurnstileToken(captchaToken, ip)
  if (!verified) {
    return {
      ok: false,
      error: 'Verification failed. Please refresh and try again.',
    }
  }

  const db = createServiceClient()
  const { data: test, error } = await db
    .from('tests')
    .select('*')
    .eq('id', testId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!test) return { ok: false, error: 'Test not found.' }

  const row = test as TestRow
  const now = Date.now()
  if (row.opens_at && now < new Date(row.opens_at).getTime()) {
    return { ok: false, error: 'This test has not opened yet.' }
  }
  if (row.closes_at && now > new Date(row.closes_at).getTime()) {
    return { ok: false, error: 'This test is closed.' }
  }

  // Do not accept a user id from the browser. The server reads the current
  // session itself so a signed-in taker cannot attach a response to somebody
  // else's history. Anonymous takers retain the original public flow.
  const { user: accountUser } = await getAuthenticatedClient()
  const takerId = accountUser?.id ?? null

  /* Single-attempt is account + test for signed-in people, with the original
     device lock retained as a fallback for public/anonymous test-takers. */
  if (row.single_attempt) {
    if (!takerId && !deviceId) {
      return {
        ok: false,
        error: 'Could not verify this device. Please reload and try again.',
      }
    }
    let existingQuery = db.from('responses').select('id').eq('test_id', testId)
    existingQuery = takerId
      ? existingQuery.eq('taker_id', takerId)
      : existingQuery.eq('device_id', deviceId)
    const { data: existing, error: existErr } = await existingQuery.limit(1)
    if (existErr) return { ok: false, error: existErr.message }
    if (existing && existing.length > 0) {
      return {
        ok: false,
        error:
          takerId
            ? 'This is a one-attempt test, and you have already submitted it from this account.'
            : 'This is a one-attempt test, and you already submitted it from this device.',
      }
    }
  }

  const questions = normalizeQuestions(row.questions)
  let autoEarned = 0
  let autoPossible = 0
  let needsGrading = false
  for (const q of questions) {
    const g = gradeQuestion(q, rawAnswers[q.id])
    if (g.auto) {
      autoPossible += q.points
      autoEarned += g.earned
    } else {
      needsGrading = true
    }
  }

  const name =
    takerName.trim() || `Anon-${Math.floor(1000 + Math.random() * 9000)}`

  let attemptNumber: number | null = null
  if (takerId) {
    const { data: priorAttempts, error: attemptsError } = await db
      .from('responses')
      .select('attempt_number')
      .eq('test_id', testId)
      .eq('taker_id', takerId)
    if (attemptsError) return { ok: false, error: attemptsError.message }
    attemptNumber =
      (priorAttempts ?? []).reduce(
        (highest, attempt) =>
          Math.max(highest, Number((attempt as { attempt_number?: number }).attempt_number) || 0),
        0,
      ) + 1
  }

  const responsePayload = {
    test_id: testId,
    taker_name: name,
    answers: rawAnswers,
    auto_earned: autoEarned,
    auto_possible: autoPossible,
    manual_scores: {},
    needs_grading: needsGrading,
    device_id: deviceId || null,
    taker_id: takerId,
    attempt_number: attemptNumber,
    test_snapshot: toTestSnapshot(row),
  }

  // The migration adds a partial unique index for account attempt numbers.
  // Retrying a collision means two tabs submitting at once still get clear,
  // distinct attempt numbers instead of overwriting or duplicating history.
  let insertedId: string | null = null
  for (let tries = 0; tries < 3 && !insertedId; tries += 1) {
    const { data: inserted, error: insErr } = await db
      .from('responses')
      .insert({
        ...responsePayload,
        attempt_number: attemptNumber === null ? null : attemptNumber + tries,
      })
      .select('id')
      .single()
    if (!insErr && inserted) {
      insertedId = (inserted as { id: string }).id
      break
    }
    if (insErr?.code !== '23505') {
      return { ok: false, error: insErr?.message ?? 'Unable to submit this test.' }
    }
  }
  if (!insertedId) {
    return { ok: false, error: 'Unable to create a new attempt. Please try again.' }
  }

  // This payload deliberately comes after the successful insert. It is the
  // only point at which correct answers and rationalizations are released to
  // the test-taker, and it is derived from the same private questions used
  // for the server-side grade above.
  return {
    ok: true,
    result: buildTestResult(questions, rawAnswers, autoEarned),
    responseId: insertedId,
  }
}

/* Lets the intro screen warn a repeat test-taker up front, before
   they fill out an entire one-attempt test, instead of only after
   they hit submit. Read-only mirror of the check submitResponse()
   enforces server-side — this doesn't replace that check, it just
   runs it ahead of time for a better message. */
export async function hasDeviceSubmitted(
  testId: string,
  deviceId: string,
): Promise<boolean> {
  if (!deviceId) return false
  const db = createServiceClient()
  const { data, error } = await db
    .from('responses')
    .select('id')
    .eq('test_id', testId)
    .eq('device_id', deviceId)
    .limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

/* Same friendly pre-flight check for the current visitor. Authenticated
   sessions are checked by account + test; anonymous sessions retain the
   device check. submitResponse() repeats this server-side before inserting,
   so this is UX only and never the enforcement boundary. */
export async function hasSubmitted(
  testId: string,
  deviceId: string,
): Promise<boolean> {
  const { user } = await getAuthenticatedClient()
  if (!user && !deviceId) return false

  let query = createServiceClient().from('responses').select('id').eq('test_id', testId)
  query = user ? query.eq('taker_id', user.id) : query.eq('device_id', deviceId)
  const { data, error } = await query.limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

export async function gradeEssay(
  testId: string,
  responseId: string,
  questionId: string,
  points: number,
): Promise<void> {
  // Ownership check, closing the IDOR gap: this SELECT goes through the
  // RLS-scoped client, so it only returns a row if the "tests_select_own"
  // policy allows it — i.e. this browser's anonymous auth.uid() actually
  // owns testId. A stranger's testId resolves to null here, before any
  // write happens. Same idiom duplicateTest() already relies on above.
  const rls = await createClient()
  const { data: owned, error: ownErr } = await rls
    .from('tests')
    .select('id')
    .eq('id', testId)
    .maybeSingle()
  if (ownErr) throw new Error(ownErr.message)
  if (!owned) throw new Error('You do not have permission to grade this response.')

  const db = createServiceClient()

  const [{ data: test, error: tErr }, { data: response, error: rErr }] =
    await Promise.all([
      db.from('tests').select('questions').eq('id', testId).maybeSingle(),
      db
        .from('responses')
        .select('manual_scores, test_snapshot')
        .eq('id', responseId)
        .maybeSingle(),
    ])
  if (tErr) throw new Error(tErr.message)
  if (rErr) throw new Error(rErr.message)
  if (!test || !response) return

  const snapshot = (response as { test_snapshot?: TestSnapshot | null })
    .test_snapshot
  const questions = Array.isArray(snapshot?.questions)
    ? snapshot.questions
    : Array.isArray((test as { questions: Question[] }).questions)
      ? (test as { questions: Question[] }).questions
      : []
  const manualScores: Record<string, number> = {
    ...((response as { manual_scores: Record<string, number> }).manual_scores ??
      {}),
    [questionId]: points,
  }
  const essays = questions.filter((q) => q.type === 'essay')
  const stillPending = essays.some((q) => manualScores[q.id] === undefined)

  const { error } = await db
    .from('responses')
    .update({ manual_scores: manualScores, needs_grading: stillPending })
    .eq('id', responseId)
  if (error) throw new Error(error.message)
}
