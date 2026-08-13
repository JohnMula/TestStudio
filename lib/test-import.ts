import {
  LIMITS,
  makeId,
  validateCreateTestInput,
  type CreateTestInput,
  type Question,
  type QType,
} from '@/lib/types'

export const MAX_JSON_IMPORT_BYTES = 1_000_000

export type ImportedTest = {
  title: string
  description: string
  questions: Question[]
}

export type ImportResult =
  | { ok: true; test: ImportedTest }
  | { ok: false; error: string }

type JsonRecord = Record<string, unknown>

const EXTERNAL_TO_INTERNAL_TYPE = {
  multiple_choice: 'multiple_choice',
  true_false: 'true_false',
  identification: 'identification',
  matching: 'matching',
  fill_in_the_blank: 'fill_blank',
  enumeration: 'enumeration',
  essay_short_answer: 'essay',
} as const satisfies Record<string, QType>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function generatedId(used: Set<string>): string {
  let id = makeId()
  while (used.has(id)) id = makeId()
  used.add(id)
  return id
}

function readId(
  value: unknown,
  used: Set<string>,
  label: string,
): { ok: true; id: string } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, id: generatedId(used) }
  if (!nonEmptyString(value)) {
    return { ok: false, error: `${label} needs a non-empty id.` }
  }
  if (used.has(value)) return { ok: false, error: `${label} has a duplicate id.` }
  used.add(value)
  return { ok: true, id: value }
}

function readPoints(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 1
}

function readExplanation(
  value: unknown,
  questionNumber: number,
): { ok: true; explanation: string } | { ok: false; error: string } {
  if (!nonEmptyString(value)) {
    return {
      ok: false,
      error: `Question ${questionNumber} is missing a rationalization.`,
    }
  }
  return { ok: true, explanation: value }
}

function readStringArray(
  value: unknown,
  label: string,
  allowEmpty = false,
): { ok: true; values: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: `${label} must be an array.` }
  if (!allowEmpty && value.length === 0) {
    return { ok: false, error: `${label} cannot be empty.` }
  }
  if (!value.every(nonEmptyString)) {
    return { ok: false, error: `${label} must contain non-empty text.` }
  }
  return { ok: true, values: value }
}

function readQuestion(
  raw: unknown,
  questionNumber: number,
  questionIds: Set<string>,
): { ok: true; question: Question } | { ok: false; error: string } {
  if (!isRecord(raw)) {
    return { ok: false, error: `Question ${questionNumber} is not an object.` }
  }

  if (typeof raw.type !== 'string') {
    return { ok: false, error: `Question ${questionNumber} is missing a question type.` }
  }
  const type = EXTERNAL_TO_INTERNAL_TYPE[
    raw.type as keyof typeof EXTERNAL_TO_INTERNAL_TYPE
  ]
  if (!type) return { ok: false, error: `Unsupported question type: ${raw.type}.` }

  if (!nonEmptyString(raw.prompt)) {
    return { ok: false, error: `Question ${questionNumber} is missing a prompt.` }
  }
  const questionId = readId(raw.id, questionIds, `Question ${questionNumber}`)
  if (!questionId.ok) return questionId
  const explanation = readExplanation(raw.rationalization, questionNumber)
  if (!explanation.ok) return explanation
  const base = {
    id: questionId.id,
    type,
    prompt: raw.prompt,
    points: readPoints(raw.points),
    explanation: explanation.explanation,
  }

  switch (type) {
    case 'multiple_choice': {
      if (!Array.isArray(raw.options) || raw.options.length < 2) {
        return {
          ok: false,
          error: `Question ${questionNumber} contains invalid multiple choice options.`,
        }
      }
      if (raw.options.length > LIMITS.optionCount) {
        return {
          ok: false,
          error: `Question ${questionNumber}: too many options (max ${LIMITS.optionCount}).`,
        }
      }
      const optionIds = new Set<string>()
      const options: { id: string; text: string }[] = []
      const correct: string[] = []
      for (const [index, rawOption] of raw.options.entries()) {
        if (
          !isRecord(rawOption) ||
          !nonEmptyString(rawOption.id) ||
          !nonEmptyString(rawOption.text)
        ) {
          return {
            ok: false,
            error: `Question ${questionNumber} contains invalid multiple choice options.`,
          }
        }
        const id = readId(
          rawOption.id,
          optionIds,
          `Option ${index + 1} in question ${questionNumber}`,
        )
        if (!id.ok) return id
        if (typeof rawOption.correct !== 'boolean') {
          return {
            ok: false,
            error: `Question ${questionNumber} contains invalid multiple choice options.`,
          }
        }
        options.push({ id: id.id, text: rawOption.text })
        if (rawOption.correct) correct.push(id.id)
      }
      if (correct.length === 0) {
        return {
          ok: false,
          error: `Multiple choice question ${questionNumber} does not contain a valid correct answer.`,
        }
      }
      if (raw.multiple !== undefined && typeof raw.multiple !== 'boolean') {
        return {
          ok: false,
          error: `Question ${questionNumber} has an invalid multiple-answer setting.`,
        }
      }
      return {
        ok: true,
        question: {
          ...base,
          type,
          options,
          correct,
          multiple: raw.multiple === true || correct.length > 1,
        },
      }
    }
    case 'true_false':
      if (typeof raw.answer !== 'boolean') {
        return {
          ok: false,
          error: `True or false question ${questionNumber} needs a true or false answer.`,
        }
      }
      return { ok: true, question: { ...base, type, answer: raw.answer } }
    case 'identification': {
      if (!nonEmptyString(raw.answer)) {
        return {
          ok: false,
          error: `Identification question ${questionNumber} is missing an answer.`,
        }
      }
      const alternates =
        raw.alternates === undefined
          ? { ok: true as const, values: [] as string[] }
          : readStringArray(raw.alternates, `Question ${questionNumber} alternates`, true)
      if (!alternates.ok) return alternates
      if (alternates.values.length > LIMITS.alternateCount) {
        return {
          ok: false,
          error: `Question ${questionNumber}: too many alternates (max ${LIMITS.alternateCount}).`,
        }
      }
      return {
        ok: true,
        question: {
          ...base,
          type,
          answer: raw.answer,
          alternates: alternates.values,
        },
      }
    }
    case 'matching': {
      if (!Array.isArray(raw.pairs) || raw.pairs.length < 2) {
        return {
          ok: false,
          error: `Matching question ${questionNumber} must contain at least two valid pairs.`,
        }
      }
      if (raw.pairs.length > LIMITS.pairCount) {
        return {
          ok: false,
          error: `Question ${questionNumber}: too many pairs (max ${LIMITS.pairCount}).`,
        }
      }
      const pairIds = new Set<string>()
      const pairs: { id: string; left: string; right: string }[] = []
      for (const [index, rawPair] of raw.pairs.entries()) {
        if (!isRecord(rawPair) || !nonEmptyString(rawPair.left) || !nonEmptyString(rawPair.right)) {
          return {
            ok: false,
            error: `Matching question ${questionNumber} contains an invalid pair.`,
          }
        }
        const id = readId(
          rawPair.id,
          pairIds,
          `Pair ${index + 1} in question ${questionNumber}`,
        )
        if (!id.ok) return id
        pairs.push({ id: id.id, left: rawPair.left, right: rawPair.right })
      }
      return { ok: true, question: { ...base, type, pairs } }
    }
    case 'fill_blank': {
      const blankCount = (base.prompt.match(/___/g) ?? []).length
      if (blankCount === 0) {
        return {
          ok: false,
          error: `Fill in the blank question ${questionNumber} must use ___ in its prompt.`,
        }
      }
      if (!Array.isArray(raw.blanks) || raw.blanks.length !== blankCount) {
        return {
          ok: false,
          error: `Fill in the blank question ${questionNumber} needs one answer list for each blank.`,
        }
      }
      if (raw.blanks.length > LIMITS.blankCount) {
        return {
          ok: false,
          error: `Question ${questionNumber}: too many blanks (max ${LIMITS.blankCount}).`,
        }
      }
      const blanks: { answers: string[] }[] = []
      for (const [index, rawBlank] of raw.blanks.entries()) {
        if (!isRecord(rawBlank)) {
          return {
            ok: false,
            error: `Fill in the blank question ${questionNumber} has an invalid answer list for blank ${index + 1}.`,
          }
        }
        const answers = readStringArray(
          rawBlank.answers,
          `Question ${questionNumber} blank ${index + 1} answers`,
        )
        if (!answers.ok) return answers
        blanks.push({ answers: answers.values })
      }
      return { ok: true, question: { ...base, type, blanks } }
    }
    case 'enumeration': {
      const answers = readStringArray(raw.answers, `Enumeration question ${questionNumber} answers`)
      if (!answers.ok) return answers
      if (answers.values.length > LIMITS.enumAnswerCount) {
        return {
          ok: false,
          error: `Question ${questionNumber}: too many answers (max ${LIMITS.enumAnswerCount}).`,
        }
      }
      if (raw.require_order !== undefined && typeof raw.require_order !== 'boolean') {
        return {
          ok: false,
          error: `Enumeration question ${questionNumber} has an invalid order setting.`,
        }
      }
      return {
        ok: true,
        question: {
          ...base,
          type,
          answers: answers.values,
          requireOrder: raw.require_order === true,
        },
      }
    }
    case 'essay':
      return { ok: true, question: { ...base, type } }
  }
}

export function parseTestStudioImport(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Invalid JSON file.' }
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'This file is not a valid TestStudio test.' }
  }
  if (!nonEmptyString(parsed.title)) {
    return { ok: false, error: 'This test is missing a title.' }
  }
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    return { ok: false, error: 'This test must contain at least one question.' }
  }

  const questionIds = new Set<string>()
  const questions: Question[] = []
  for (const [index, rawQuestion] of parsed.questions.entries()) {
    const question = readQuestion(rawQuestion, index + 1, questionIds)
    if (!question.ok) return question
    questions.push(question.question)
  }

  const validationError = validateCreateTestInput({
    title: parsed.title,
    description: typeof parsed.description === 'string' ? parsed.description : '',
    timeLimit: '15m',
    shuffle: true,
    shuffleChoices: true,
    singleAttempt: false,
    questions,
  } satisfies CreateTestInput)
  if (validationError) return { ok: false, error: validationError }

  return {
    ok: true,
    test: {
      title: parsed.title,
      description:
        typeof parsed.description === 'string'
          ? parsed.description.slice(0, LIMITS.description)
          : '',
      questions,
    },
  }
}

export const DEFAULT_AI_IMPORT_PROMPT = `Create a test for my TestStudio application.

Return ONLY one valid JSON object that follows the TestStudio import format below. Do not return Markdown, code fences, comments, trailing commas, or explanations before or after the JSON.

Use this top-level structure exactly:
{
  "title": "Example Test Title",
  "description": "Example test description",
  "questions": []
}

Use the instructions, topic, and source material in MY TEST REQUEST at the end. Keep facts accurate. If I say to use only supplied material, do not invent facts. Match the requested number and mix of question types exactly.

Every question must have a unique "id", plus "type", "prompt", "points", and a useful "rationalization". "points" must be a positive number. Use exactly one of these type names:
- "multiple_choice"
- "true_false"
- "identification"
- "matching"
- "fill_in_the_blank"
- "enumeration"
- "essay_short_answer"

For "multiple_choice", use this structure. Every option id must be unique within its question. Mark correct options with true. The option id, never its displayed A/B/C/D position, is the answer identity. Use "multiple": true only when more than one answer may be selected.
{
  "id": "question_1",
  "type": "multiple_choice",
  "prompt": "Who wrote Noli Me Tangere?",
  "points": 1,
  "multiple": false,
  "options": [
    { "id": "option_1", "text": "Andres Bonifacio", "correct": false },
    { "id": "option_2", "text": "Jose Rizal", "correct": true },
    { "id": "option_3", "text": "Emilio Aguinaldo", "correct": false },
    { "id": "option_4", "text": "Apolinario Mabini", "correct": false }
  ],
  "rationalization": "Jose Rizal wrote Noli Me Tangere."
}

For "true_false", "answer" must be the JSON boolean true or false:
{ "id": "question_2", "type": "true_false", "prompt": "Water freezes at 0°C at standard pressure.", "points": 1, "answer": true, "rationalization": "At standard atmospheric pressure, water freezes at 0°C." }

For "identification", provide a non-empty "answer" and optional accepted "alternates":
{ "id": "question_3", "type": "identification", "prompt": "What is the largest planet in our solar system?", "points": 1, "answer": "Jupiter", "alternates": [], "rationalization": "Jupiter is the largest planet in the solar system." }

For "matching", provide at least two pairs. Each pair needs a unique id, non-empty "left", and non-empty "right":
{ "id": "question_4", "type": "matching", "prompt": "Match each term to its definition.", "points": 2, "pairs": [{ "id": "pair_1", "left": "Mitochondria", "right": "Produces cellular energy" }, { "id": "pair_2", "left": "Nucleus", "right": "Contains genetic material" }], "rationalization": "These are the standard functions of the organelles." }

For "fill_in_the_blank", put one ___ marker in the prompt for every item in "blanks". Each blank needs a non-empty array of accepted answers:
{ "id": "question_5", "type": "fill_in_the_blank", "prompt": "The capital of France is ___.", "points": 1, "blanks": [{ "answers": ["Paris"] }], "rationalization": "Paris is the capital city of France." }

For "enumeration", provide one or more expected answers. Set "require_order" to true only when learners must supply them in that exact order:
{ "id": "question_6", "type": "enumeration", "prompt": "Name the three primary colors of light.", "points": 3, "answers": ["Red", "Green", "Blue"], "require_order": false, "rationalization": "Red, green, and blue are the additive primary colors of light." }

For "essay_short_answer", do not provide an answer key because TestStudio grades it by hand:
{ "id": "question_7", "type": "essay_short_answer", "prompt": "Explain the importance of photosynthesis.", "points": 5, "rationalization": "Responses should explain how photosynthesis converts light energy into chemical energy and supports food chains." }

Do not add unsupported properties. Do not use visible A/B/C/D labels as the permanent answer identity. Preserve labels such as "A. Apple" only when those labels are intentionally part of the option text. Use double quotes for all JSON keys and strings.

MY TEST REQUEST:
Create a 10-item multiple choice test about the topic I provide. Replace this request with my preferred title, description, subject, topic, difficulty, language, question counts, source material, and instructions before generating the JSON.`
