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

export type ChoiceOption = {
  id: string
  text: string
}

export type MultipleChoiceQ = BaseQ & {
  type: 'multiple_choice'
  options: ChoiceOption[]
  correct: string[]
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
      const firstOption = { id: makeId(), text: '' }
      return {
        ...base,
        type,
        options: [firstOption, { id: makeId(), text: '' }],
        correct: [firstOption.id],
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

/* Choice IDs, rather than their rendered A/B/C/D positions, are the answer
   identity. The legacy helper makes tests saved before choice IDs existed
   safe to read and edit without a database-wide JSON rewrite. */
function legacyChoiceOptionId(questionId: string, index: number): string {
  return `${questionId}:option:${index}`
}

export function normalizeQuestion(question: Question): Question {
  if (question.type !== 'multiple_choice') return question

  const rawOptions = question.options as unknown[]
  const options: ChoiceOption[] = rawOptions.map((raw, index) => {
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as ChoiceOption).id === 'string' &&
      typeof (raw as ChoiceOption).text === 'string'
    ) {
      return raw as ChoiceOption
    }
    return {
      id: legacyChoiceOptionId(question.id, index),
      text: typeof raw === 'string' ? raw : '',
    }
  })
  const ids = new Set(options.map((option) => option.id))
  const correct = Array.isArray(question.correct)
    ? question.correct.flatMap((value) => {
        if (typeof value === 'string' && ids.has(value)) return [value]
        // Old attempts used original option indexes. This is only a
        // compatibility conversion; new answers always contain option IDs.
        if (typeof value === 'number' && Number.isInteger(value)) {
          const option = options[value]
          return option ? [option.id] : []
        }
        return []
      })
    : []

  return {
    ...question,
    options,
    correct: [...new Set(correct)],
  }
}

export function normalizeQuestions(questions: unknown): Question[] {
  return Array.isArray(questions)
    ? questions.map((question) => normalizeQuestion(question as Question))
    : []
}

const EXPLICIT_CHOICE_LABEL = /^\s*[A-Da-d]\.(?:\s|$)/

/* The label is creator-authored content, not an app-assigned position. Only
   treat it as intentional when every option carries the label pattern, so a
   sentence such as "A. fact is ..." does not disable shuffling by itself. */
export function choicesHaveExplicitLabels(options: readonly ChoiceOption[]): boolean {
  return (
    options.length > 1 &&
    options.every((option) => EXPLICIT_CHOICE_LABEL.test(option.text))
  )
}

export function orderedChoiceOptions(
  options: readonly ChoiceOption[],
  seed: string,
  shuffleChoices: boolean,
): ChoiceOption[] {
  if (!shuffleChoices || choicesHaveExplicitLabels(options)) return [...options]
  return seededShuffle(options, seed)
}

/* ---------- public (answer-free) question shapes ---------- */

export type PublicQuestion =
  | {
      id: string
      type: 'multiple_choice'
      prompt: string
      points: number
      options: ChoiceOption[]
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

export function toPublicQuestion(
  q: Question,
  shuffleChoices = false,
): PublicQuestion {
  switch (q.type) {
    case 'multiple_choice':
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: orderedChoiceOptions(q.options, `${q.id}:choices`, shuffleChoices),
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
  shuffleChoices: boolean
  singleAttempt: boolean
  opensAt: number | null
  closesAt: number | null
  questions: PublicQuestion[]
}

/* ---------- post-submission result shapes ---------- */

/* These are intentionally separate from PublicQuestion. They are built from
   the private question definition on the server and are returned only after a
   response has been successfully recorded. Keeping them out of PublicTest
   preserves the pre-submission answer-key boundary. */
export type ResultQuestionStatus = 'correct' | 'incorrect' | 'manual'

export type ResultQuestionReview = {
  questionId: string
  type: QType
  prompt: string
  submittedAnswer: string[]
  correctAnswer?: string[]
  explanation?: string
  status: ResultQuestionStatus
  pointsEarned: number
  pointsPossible: number
}

export type TestResult = {
  scoreEarned: number
  totalPossible: number
  percentage: number
  correctCount: number
  incorrectCount: number
  manualGradingCount: number
  needsGrading: boolean
  questions: ResultQuestionReview[]
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
      const sel = Array.isArray(answer)
        ? answer.flatMap((value) => {
            if (typeof value === 'string') return [value]
            // Compatibility for responses submitted before option IDs were
            // introduced. Display positions are never used for new answers.
            if (typeof value === 'number' && Number.isInteger(value)) {
              return q.options[value] ? [q.options[value].id] : []
            }
            return []
          })
        : []
      const want = new Set(q.correct)
      const unique = [...new Set(sel)]
      const ok = unique.length === want.size && unique.every((id) => want.has(id))
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

export type TestSnapshot = {
  title: string
  code: string
  timeLimit: string
  shuffle: boolean
  shuffleChoices: boolean
  singleAttempt: boolean
  opensAt: number | null
  closesAt: number | null
  questions: Question[]
}

export type Response = {
  id: string
  takerName: string
  submittedAt: number
  answers: Record<string, unknown>
  autoEarned: number
  autoPossible: number
  manualScores: Record<string, number> // questionId -> awarded points
  needsGrading: boolean
  testSnapshot?: TestSnapshot
}

export type Test = {
  id: string
  title: string
  code: string
  timeLimit: string
  shuffle: boolean
  shuffleChoices: boolean
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

export function responsePossible(test: Test, r: Response): number {
  return possiblePoints({ questions: r.testSnapshot?.questions ?? test.questions })
}

/* input accepted by the create-test server action */
export type CreateTestInput = {
  title: string
  code?: string
  timeLimit: string
  shuffle: boolean
  shuffleChoices: boolean
  singleAttempt: boolean
  questions: Question[]
  opensAt?: number | null
  closesAt?: number | null
}

/* ---------- server-side size limits ----------
   createTest() used to insert whatever shape of questions array the
   client sent, with no cap on count or string length. These numbers
   are generous for a genuinely large test but bounded, so a scripted
   flood of oversized payloads can't push unbounded data into the row. */

export const LIMITS = {
  title: 200,
  questionCount: 200,
  prompt: 5000,
  explanation: 5000,
  optionCount: 20,
  optionText: 500,
  pairCount: 50,
  pairText: 500,
  blankCount: 50,
  blankAnswerCount: 20,
  enumAnswerCount: 100,
  answerText: 500,
  alternateCount: 50,
} as const

function tooLong(value: string, max: number, label: string): string | null {
  return value.length > max ? `${label} is too long (max ${max} characters).` : null
}

/* Returns an error message, or null if the input is within limits.
   Called at the top of createTest(), before anything touches the DB. */
export function validateCreateTestInput(input: CreateTestInput): string | null {
  if (!input.title?.trim()) return 'Title is required.'
  const titleErr = tooLong(input.title, LIMITS.title, 'Title')
  if (titleErr) return titleErr

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    return 'At least one question is required.'
  }
  if (input.questions.length > LIMITS.questionCount) {
    return `Too many questions (max ${LIMITS.questionCount}).`
  }

  for (const [i, q] of input.questions.entries()) {
    const n = i + 1
    const promptErr = tooLong(q.prompt ?? '', LIMITS.prompt, `Question ${n} prompt`)
    if (promptErr) return promptErr
    if (q.explanation) {
      const expErr = tooLong(
        q.explanation,
        LIMITS.explanation,
        `Question ${n} explanation`,
      )
      if (expErr) return expErr
    }

    switch (q.type) {
      case 'multiple_choice': {
        if (q.options.length > LIMITS.optionCount) {
          return `Question ${n}: too many options (max ${LIMITS.optionCount}).`
        }
        const optionIds = new Set(q.options.map((option) => option.id))
        if (q.options.some((option) => !option.id) || optionIds.size !== q.options.length) {
          return `Question ${n}: each option needs a unique ID.`
        }
        if (q.correct.some((id) => !optionIds.has(id))) {
          return `Question ${n}: a correct answer does not match an option.`
        }
        for (const opt of q.options) {
          const e = tooLong(opt.text, LIMITS.optionText, `Question ${n} option`)
          if (e) return e
        }
        break
      }
      case 'identification': {
        const e1 = tooLong(q.answer ?? '', LIMITS.answerText, `Question ${n} answer`)
        if (e1) return e1
        if (q.alternates.length > LIMITS.alternateCount) {
          return `Question ${n}: too many alternates (max ${LIMITS.alternateCount}).`
        }
        for (const alt of q.alternates) {
          const e = tooLong(alt, LIMITS.answerText, `Question ${n} alternate`)
          if (e) return e
        }
        break
      }
      case 'matching': {
        if (q.pairs.length > LIMITS.pairCount) {
          return `Question ${n}: too many pairs (max ${LIMITS.pairCount}).`
        }
        for (const p of q.pairs) {
          const e1 = tooLong(p.left, LIMITS.pairText, `Question ${n} pair`)
          if (e1) return e1
          const e2 = tooLong(p.right, LIMITS.pairText, `Question ${n} pair`)
          if (e2) return e2
        }
        break
      }
      case 'fill_blank': {
        if (q.blanks.length > LIMITS.blankCount) {
          return `Question ${n}: too many blanks (max ${LIMITS.blankCount}).`
        }
        for (const b of q.blanks) {
          if (b.answers.length > LIMITS.blankAnswerCount) {
            return `Question ${n}: too many accepted answers for a blank (max ${LIMITS.blankAnswerCount}).`
          }
          for (const a of b.answers) {
            const e = tooLong(a, LIMITS.answerText, `Question ${n} blank answer`)
            if (e) return e
          }
        }
        break
      }
      case 'enumeration': {
        if (q.answers.length > LIMITS.enumAnswerCount) {
          return `Question ${n}: too many answers (max ${LIMITS.enumAnswerCount}).`
        }
        for (const a of q.answers) {
          const e = tooLong(a, LIMITS.answerText, `Question ${n} answer`)
          if (e) return e
        }
        break
      }
      case 'true_false':
      case 'essay':
        break
    }
  }

  return null
}
