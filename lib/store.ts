'use client'

import useSWR, { mutate } from 'swr'
import { useSyncExternalStore } from 'react'
import {
  createTest as createTestAction,
  deleteTest as deleteTestAction,
  duplicateTest as duplicateTestAction,
  gradeEssay as gradeEssayAction,
  getTest,
  listTests,
  type CreateTestResult,
} from '@/lib/actions'
import { makeId, type CreateTestInput, type Question, type Test } from '@/lib/types'

/* Re-export the shared, server-safe types and pure helpers so existing
   components can keep importing them from '@/lib/store'. */
export * from '@/lib/types'
export type { CreateTestResult } from '@/lib/actions'

/* ============================================================
   Tests & responses — backed by Supabase via server actions.
   SWR handles client-side caching and revalidation.
   ============================================================ */

export function useTests(): Test[] {
  const { data } = useSWR('tests', () => listTests())
  return data ?? []
}

export function useTest(id: string): Test | undefined {
  const { data } = useSWR(id ? ['test', id] : null, () => getTest(id))
  return data ?? undefined
}

export async function createTest(
  input: CreateTestInput,
): Promise<CreateTestResult> {
  const res = await createTestAction(input)
  if (res.ok) await mutate('tests')
  return res
}

export async function deleteTest(id: string): Promise<void> {
  await deleteTestAction(id)
  await Promise.all([mutate('tests'), mutate(['test', id])])
}

export async function duplicateTest(
  id: string,
): Promise<{ id: string } | null> {
  const res = await duplicateTestAction(id)
  if (res) await mutate('tests')
  return res
}

export async function gradeEssay(
  testId: string,
  responseId: string,
  questionId: string,
  points: number,
): Promise<void> {
  await gradeEssayAction(testId, responseId, questionId, points)
  await mutate(['test', testId])
}

/* ============================================================
   Question bank — a per-device authoring aid. Because there are
   no accounts, this stays in localStorage: it's the creator's
   private library of reusable questions on this browser.
   ============================================================ */

const BANK_KEY = 'teststudio.bank.v1'

export type BankItem = {
  id: string
  subject: string
  question: Question
}

let bankCache: BankItem[] | null = null
const bankListeners = new Set<() => void>()

function readBank(): BankItem[] {
  if (typeof window === 'undefined') return []
  if (bankCache) return bankCache
  try {
    const raw = window.localStorage.getItem(BANK_KEY)
    bankCache = raw ? (JSON.parse(raw) as BankItem[]) : []
  } catch {
    bankCache = []
  }
  return bankCache
}

function writeBank(next: BankItem[]) {
  bankCache = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BANK_KEY, JSON.stringify(next))
  }
  bankListeners.forEach((l) => l())
}

function subscribeBank(l: () => void) {
  bankListeners.add(l)
  return () => bankListeners.delete(l)
}

const EMPTY_BANK: BankItem[] = []

export function useBank(): BankItem[] {
  return useSyncExternalStore(subscribeBank, readBank, () => EMPTY_BANK)
}

export function saveToBank(subject: string, question: Question) {
  const item: BankItem = {
    id: makeId(),
    subject: subject.trim() || 'General',
    question: { ...question, id: makeId() },
  }
  writeBank([item, ...readBank()])
}

export function removeFromBank(id: string) {
  writeBank(readBank().filter((b) => b.id !== id))
}

/* ============================================================
   Autosaved builder draft — also a per-device convenience so an
   in-progress test survives an accidental refresh before publish.
   ============================================================ */

const DRAFT_KEY = 'teststudio.draft.v2'

export type Draft = {
  title: string
  code: string
  timeLimit: string
  shuffle: boolean
  singleAttempt: boolean
  questions: Question[]
  opensAt: number | null
  closesAt: number | null
  savedAt: number
}

export function loadDraft(): Draft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function saveDraft(draft: Omit<Draft, 'savedAt'>) {
  if (typeof window === 'undefined') return
  const full: Draft = { ...draft, savedAt: Date.now() }
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(full))
}

export function clearDraft() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DRAFT_KEY)
  }
}
