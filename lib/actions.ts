'use server'

import { createServiceClient } from '@/lib/supabase/server'
import {
  gradeQuestion,
  makeCode,
  toPublicQuestion,
  type CreateTestInput,
  type PublicTest,
  type Question,
  type Response,
  type Test,
} from '@/lib/types'

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

export async function listTests(): Promise<Test[]> {
  const db = createServiceClient()
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

export async function getTest(id: string): Promise<Test | null> {
  const db = createServiceClient()
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
   and matching pairings are stripped server-side and never sent. */
export async function getPublicTestByCode(
  code: string,
): Promise<PublicTest | null> {
  const db = createServiceClient()
  const { data: test, error } = await db
    .from('tests')
    .select('*')
    .ilike('code', code.trim())
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

async function codeExists(code: string, exceptId?: string): Promise<boolean> {
  const db = createServiceClient()
  let query = db.from('tests').select('id').ilike('code', code)
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
  const db = createServiceClient()

  let code = input.code?.trim().toUpperCase() || ''
  if (code) {
    if (await codeExists(code)) {
      return { ok: false, error: 'That code is already taken.' }
    }
  } else {
    code = makeCode()
    while (await codeExists(code)) code = makeCode()
  }

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

export async function deleteTest(id: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.from('tests').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateTest(id: string): Promise<{ id: string } | null> {
  const db = createServiceClient()
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
   question definitions — the taker's browser never sees the key. */
export async function submitResponse(
  testId: string,
  rawAnswers: Record<string, unknown>,
  takerName: string,
): Promise<SubmitResult> {
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
  })
  if (insErr) return { ok: false, error: insErr.message }

  return { ok: true, autoEarned, autoPossible, needsGrading }
}

export async function gradeEssay(
  testId: string,
  responseId: string,
  questionId: string,
  points: number,
): Promise<void> {
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
