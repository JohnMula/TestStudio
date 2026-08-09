/* ============================================================
   Shared, pure helpers + types.
   Safe to import from BOTH server and client — no React, no
   localStorage, no secrets. Answer keys never leak to the
   client because the taker only ever receives PublicQuestion.
   ============================================================ */

/* ---------- question types ---------- */

export type QType =
  | 'multiple_choice'
  | 'true_false'
  | 'identification'
  | 'matching'
  | 'fill_blank'
  | 'enumeration'
  | 'essay'

type BaseQ = {
  id: string
  type: QType
  prompt: string
  points: number
  explanation?: string
}

export type MultipleChoiceQ = BaseQ & {
  type: 'multiple_choice'
  options: string[]
  correct: number[]
  multiple: boolean
}
export type TrueFalseQ = BaseQ & { type: 'true_false'; answer: boolean }
export type IdentificationQ = BaseQ & {
  type: 'identification'
  answer: string
  alternates: string[]
}
export type MatchPair = { id: string; left: string; right: string }
export type MatchingQ = BaseQ & { type: 'matching'; pairs: MatchPair[] }
export type FillBlankQ = BaseQ & {
  type: 'fill_blank'
  blanks: { answers: string[] }[]
}
export type EnumerationQ = BaseQ & {
  type: 'enumeration'
  answers: string[]
  requireOrder: boolean
}
export type EssayQ = BaseQ & { type: 'essay' }

export type Question =
  | MultipleChoiceQ
  | TrueFalseQ
  | IdentificationQ
  | MatchingQ
  | FillBlankQ
  | EnumerationQ
  | EssayQ

export const QUESTION_TYPES: {
  type: QType
  label: string
  hint: string
  auto: boolean
}[] = [
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    hint: 'Pick one or more correct options',
    auto: true,
  },
  {
    type: 'true_false',
    label: 'True or False',
    hint: 'A statement judged true or false',
    auto: true,
  },
  {
    type: 'identification',
    label: 'Identification',
    hint: 'One term, with accepted alternates',
    auto: true,
  },
  {
    type: 'matching',
    label: 'Matching',
    hint: 'Pair items across two columns',
    auto: true,
  },
  {
    type: 'fill_blank',
    label: 'Fill in the Blank',
    hint: 'Use ___ to mark each blank',
    auto: true,
  },
  {
    type: 'enumeration',
    label: 'Enumeration',
    hint: 'List several accepted answers',
    auto: true,
  },
  {
    type: 'essay',
    label: 'Essay / Short Answer',
    hint: 'Open response, graded by hand',
    auto: false,
  },
]

export function typeMeta(type: QType) {
  return QUESTION_TYPES.find((t) => t.type === type)!
}

/* ---------- ids & codes ---------- */

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('')
  return `${pick(4)}-${pick(2)}`
}

/* ---------- question factory ---------- */

export function blankQuestion(type: QType): Question {
  const base = { id: makeId(), prompt: '', points: 1, explanation: '' }
  switch (type) {
    case 'multiple_choice':
      return {
        ...base,
        type,
        options: ['', ''],
        correct: [0],
        multiple: false,
      }
    case 'true_false':
      return { ...base, type, answer: true }
    case 'identification':
      return { ...base, type, answer: '', alternates: [] }
    case 'matching':
      return {
        ...base,
        type,
        pairs: [
          { id: makeId(), left: '', right: '' },
          { id: makeId(), left: '', right: '' },
        ],
      }
    case 'fill_blank':
      return { ...base, type, blanks: [{ answers: [''] }] }
    case 'enumeration':
      return { ...base, type, answers: ['', ''], requireOrder: false }
    case 'essay':
      return { ...base, type }
  }
}

/* ---------- deterministic shuffle (stable across server + client) ---------- */

export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ---------- public (answer-free) question shapes ---------- */

export type PublicQuestion =
  | {
      id: string
      type: 'multiple_choice'
      prompt: string
      points: number
      options: string[]
      multiple: boolean
    }
  | { id: string; type: 'true_false'; prompt: string; points: number }
  | { id: string; type: 'identification'; prompt: string; points: number }
  | {
      id: string
      type: 'fill_blank'
      prompt: string
      points: number
      blankCount: number
    }
  | {
      id: string
      type: 'enumeration'
      prompt: string
      points: number
      answerCount: number
    }
  | {
      id: string
      type: 'matching'
      prompt: string
      points: number
      lefts: { key: string; text: string }[]
      rights: { key: string; text: string }[]
    }
  | { id: string; type: 'essay'; prompt: string; points: number }

/* right-option keys for matching are derived from the seeded shuffle
   order (r0, r1, …) and never share an id with their left, so the
   correct pairing can't be read out of the payload. */
function matchingRightKey(index: number): string {
  return `r${index}`
}

export function toPublicQuestion(q: Question): PublicQuestion {
  switch (q.type) {
    case 'multiple_choice':
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: q.options,
        multiple: q.multiple,
      }
    case 'true_false':
    case 'identification':
    case 'essay':
      return { id: q.id, type: q.type, prompt: q.prompt, points: q.points }
    case 'fill_blank':
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        blankCount: q.blanks.length,
      }
    case 'enumeration':
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        answerCount: q.answers.length,
      }
    case 'matching': {
      const shuffled = seededShuffle(q.pairs, `${q.id}:rights`)
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        lefts: q.pairs.map((p) => ({ key: p.id, text: p.left })),
        rights: shuffled.map((p, i) => ({
          key: matchingRightKey(i),
          text: p.right,
        })),
      }
    }
  }
}

export type PublicTest = {
  id: string
  title: string
  code: string
  timeLimit: string
  shuffle: boolean
  singleAttempt: boolean
  opensAt: number | null
  closesAt: number | null
  questions: PublicQuestion[]
}

/* ---------- grading (server-side only) ---------- */

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type Grade = { auto: boolean; correct: boolean; earned: number }

export function gradeQuestion(q: Question, answer: unknown): Grade {
  const pts = q.points
  const win = (correct: boolean, auto = true): Grade => ({
    auto,
    correct,
    earned: correct ? pts : 0,
  })

  switch (q.type) {
    case 'essay':
      return { auto: false, correct: false, earned: 0 }
    case 'multiple_choice': {
      const sel = Array.isArray(answer) ? (answer as number[]) : []
      const want = new Set(q.correct)
      const ok = sel.length === want.size && sel.every((i) => want.has(i))
      return win(ok)
    }
    case 'true_false':
      return win(answer === q.answer)
    case 'identification': {
      const acc = [q.answer, ...q.alternates].map(norm).filter(Boolean)
      return win(typeof answer === 'string' && acc.includes(norm(answer)))
    }
    case 'fill_blank': {
      const ans = Array.isArray(answer) ? (answer as string[]) : []
      const ok = q.blanks.every((b, i) => {
        const acc = b.answers.map(norm).filter(Boolean)
        return acc.length > 0 && acc.includes(norm(ans[i] ?? ''))
      })
      return win(ok)
    }
    case 'enumeration': {
      const ans = Array.isArray(answer)
        ? (answer as string[]).map(norm).filter(Boolean)
        : []
      const key = q.answers.map(norm).filter(Boolean)
      let ok: boolean
      if (q.requireOrder) {
        ok = ans.length === key.length && key.every((k, i) => k === ans[i])
      } else {
        const set = new Set(ans)
        ok =
          key.length > 0 && key.length === set.size && key.every((k) => set.has(k))
      }
      return win(ok)
    }
    case 'matching': {
      // taker submits { leftPairId: rightKey }, where rightKey (r0, r1, …)
      // maps back to a pair via the same seeded shuffle used to publish it.
      const map =
        answer && typeof answer === 'object'
          ? (answer as Record<string, string>)
          : {}
      const shuffled = seededShuffle(q.pairs, `${q.id}:rights`)
      const rightKeyToPairId = new Map<string, string>()
      shuffled.forEach((p, i) => rightKeyToPairId.set(matchingRightKey(i), p.id))
      const ok =
        q.pairs.length > 0 &&
        q.pairs.every((p) => rightKeyToPairId.get(map[p.id]) === p.id)
      return win(ok)
    }
  }
}

/* ============================================================
   Response + Test domain types (as used across the UI)
   ============================================================ */

export type Response = {
  id: string
  takerName: string
  submittedAt: number
  answers: Record<string, unknown>
  autoEarned: number
  autoPossible: number
  manualScores: Record<string, number> // questionId -> awarded points
  needsGrading: boolean
}

export type Test = {
  id: string
  title: string
  code: string
  timeLimit: string
  shuffle: boolean
  singleAttempt: boolean
  createdAt: number
  questions: Question[]
  responses: Response[]
  opensAt?: number | null
  closesAt?: number | null
}

export function possiblePoints(test: { questions: Question[] }): number {
  return test.questions.reduce((s, q) => s + q.points, 0)
}

export function possiblePointsPublic(test: {
  questions: { points: number }[]
}): number {
  return test.questions.reduce((s, q) => s + q.points, 0)
}

export function responseEarned(test: Test, r: Response): number {
  const manual = Object.values(r.manualScores).reduce((s, n) => s + n, 0)
  return r.autoEarned + manual
}

/* input accepted by the create-test server action */
export type CreateTestInput = {
  title: string
  code?: string
  timeLimit: string
  shuffle: boolean
  singleAttempt: boolean
  questions: Question[]
  opensAt?: number | null
  closesAt?: number | null
}
