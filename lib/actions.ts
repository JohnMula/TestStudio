'use server'

import { createServiceClient, createClient } from '@/lib/supabase/server'
import {
  gradeQuestion,
  makeCode,
  toPublicQuestion,
  validateCreateTestInput,
  type CreateTestInput,
  type PublicTest,
  type Question,
  type Response,
  type Test,
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
}

function ms(value: string | null): number | null {
  return value ? new Date(value).getTime() : null
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
  }
}

function mapTest(row: TestRow, responses: ResponseRow[]): Test {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    timeLimit: row.time_limit,
    shuffle: row.shuffle,
    singleAttempt: row.single_attempt,
    createdAt: new Date(row.created_at).getTime(),
    questions: Array.isArray(row.questions) ? row.questions : [],
    responses: responses
      .map(mapResponse)
      .sort((a, b) => b.submittedAt - a.submittedAt),
    opensAt: ms(row.opens_at),
    closesAt: ms(row.closes_at),
  }
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
  const questions = Array.isArray(row.questions) ? row.questions : []
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    timeLimit: row.time_limit,
    shuffle: row.shuffle,
    singleAttempt: row.single_attempt,
    opensAt: ms(row.opens_at),
    closesAt: ms(row.closes_at),
    questions: questions.map(toPublicQuestion),
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

/* RLS ("tests_delete_own") makes this a no-op if the caller doesn't
   own the row — no separate ownership check needed here. */
export async function deleteTest(id: string): Promise<void> {
  const db = await createClient()
  const { error } = await db.from('tests').delete().eq('id', id)
  if (error) throw new Error(error.message)
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
      single_attempt: row.single_attempt,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
      questions: row.questions,
    })
    .select('id')
    .single()
  if (insErr) throw new Error(insErr.message)
  return { id: (data as { id: string }).id }
}

export type SubmitResult =
  | {
      ok: true
      autoEarned: number
      autoPossible: number
      needsGrading: boolean
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

  /* Single-attempt lock, closing the gap flagged in the security
     review: single_attempt was stored on the row but nothing ever
     read it back. Enforced by device id (lib/store.ts —
     getDeviceId()) rather than an account, since takers never sign
     in — this stops an accidental or casual retake, not someone who
     deliberately clears site data or switches browsers. Requires a
     device_id column on responses; see supabase/single_attempt.sql. */
  if (row.single_attempt) {
    if (!deviceId) {
      return {
        ok: false,
        error: 'Could not verify this device. Please reload and try again.',
      }
    }
    const { data: existing, error: existErr } = await db
      .from('responses')
      .select('id')
      .eq('test_id', testId)
      .eq('device_id', deviceId)
      .limit(1)
    if (existErr) return { ok: false, error: existErr.message }
    if (existing && existing.length > 0) {
      return {
        ok: false,
        error:
          'This is a one-attempt test, and you already submitted it from this device.',
      }
    }
  }

  const questions = Array.isArray(row.questions) ? row.questions : []
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

  const { error: insErr } = await db.from('responses').insert({
    test_id: testId,
    taker_name: name,
    answers: rawAnswers,
    auto_earned: autoEarned,
    auto_possible: autoPossible,
    manual_scores: {},
    needs_grading: needsGrading,
    device_id: deviceId || null,
  })
  if (insErr) return { ok: false, error: insErr.message }

  return { ok: true, autoEarned, autoPossible, needsGrading }
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
        .select('manual_scores')
        .eq('id', responseId)
        .maybeSingle(),
    ])
  if (tErr) throw new Error(tErr.message)
  if (rErr) throw new Error(rErr.message)
  if (!test || !response) return

  const questions = Array.isArray((test as { questions: Question[] }).questions)
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