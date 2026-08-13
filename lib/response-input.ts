import 'server-only'

import { toPublicQuestion, LIMITS, type Question } from '@/lib/types'

type AnswerMap = Record<string, unknown>

export type ResponseInputResult =
  | { ok: true; answers: AnswerMap; takerName: string; deviceId: string }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textValue(
  value: unknown,
  maxLength: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || value.length > maxLength) {
    return { ok: false, error: 'One or more submitted answers are invalid.' }
  }
  return { ok: true, value: value.trim() }
}

function inputSizeIsSafe(value: unknown): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length <= LIMITS.responseBytes
  } catch {
    return false
  }
}

function normalizeAnswer(
  question: Question,
  raw: unknown,
): { ok: true; answer: unknown } | { ok: false; error: string } {
  switch (question.type) {
    case 'multiple_choice': {
      if (!Array.isArray(raw) || raw.length > question.options.length) {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      if (!raw.every((value) => typeof value === 'string')) {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      const allowed = new Set(question.options.map((option) => option.id))
      if (raw.some((value) => !allowed.has(value))) {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      const answer = [...new Set(raw)]
      if (!question.multiple && answer.length > 1) {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      return { ok: true, answer }
    }
    case 'true_false':
      return typeof raw === 'boolean'
        ? { ok: true, answer: raw }
        : { ok: false, error: 'One or more submitted answers are invalid.' }
    case 'identification':
    case 'essay': {
      const text = textValue(raw, LIMITS.responseText)
      return text.ok ? { ok: true, answer: text.value } : text
    }
    case 'fill_blank':
    case 'enumeration': {
      const maxItems =
        question.type === 'fill_blank'
          ? question.blanks.length
          : question.answers.length
      if (!Array.isArray(raw) || raw.length > maxItems) {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      const answer: string[] = []
      for (const value of raw) {
        // Sparse arrays from a learner answering a later field serialize as
        // null. Treat them as blank answers rather than rejecting the test.
        if (value === null || value === undefined) {
          answer.push('')
          continue
        }
        const text = textValue(value, LIMITS.responseText)
        if (!text.ok) return text
        answer.push(text.value)
      }
      return { ok: true, answer }
    }
    case 'matching': {
      if (!isRecord(raw)) {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      const publicQuestion = toPublicQuestion(question)
      if (publicQuestion.type !== 'matching') {
        return { ok: false, error: 'One or more submitted answers are invalid.' }
      }
      const leftKeys = new Set(publicQuestion.lefts.map((item) => item.key))
      const rightKeys = new Set(publicQuestion.rights.map((item) => item.key))
      const answer: Record<string, string> = {}
      for (const [left, right] of Object.entries(raw)) {
        if (!leftKeys.has(left) || typeof right !== 'string') {
          return { ok: false, error: 'One or more submitted answers are invalid.' }
        }
        if (right && !rightKeys.has(right)) {
          return { ok: false, error: 'One or more submitted answers are invalid.' }
        }
        if (right) answer[left] = right
      }
      return { ok: true, answer }
    }
  }
}

export function validateResponseInput(
  questions: Question[],
  rawAnswers: unknown,
  rawName: unknown,
  rawDeviceId: unknown,
): ResponseInputResult {
  if (!isRecord(rawAnswers) || !inputSizeIsSafe(rawAnswers)) {
    return { ok: false, error: 'Your submitted answers are invalid or too large.' }
  }
  const name = textValue(rawName, LIMITS.takerName)
  if (!name.ok) {
    return { ok: false, error: 'Your name is invalid or too long.' }
  }
  if (typeof rawDeviceId !== 'string' || rawDeviceId.length > 200) {
    return { ok: false, error: 'This device could not be verified. Please reload and try again.' }
  }

  const questionById = new Map(questions.map((question) => [question.id, question]))
  if (Object.keys(rawAnswers).some((id) => !questionById.has(id))) {
    return { ok: false, error: 'One or more submitted answers are invalid.' }
  }

  const answers: AnswerMap = {}
  for (const [id, raw] of Object.entries(rawAnswers)) {
    const question = questionById.get(id)
    if (!question) continue
    const answer = normalizeAnswer(question, raw)
    if (!answer.ok) return answer
    answers[id] = answer.answer
  }
  return { ok: true, answers, takerName: name.value, deviceId: rawDeviceId }
}
