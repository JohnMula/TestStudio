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

/* ============================================================
   App settings — real, persisted preferences for the Settings
   page. Two kinds of thing live here:

     - defaults that pre-fill the create-test form (time limit,
       shuffle, single-attempt). The published test still stores
       its own values once created — this only affects what a
       NEW test starts as, and can always be changed per test
       before publishing.
     - export preferences (whether a CSV export includes the
       submitted-at column).

   Same idiom as the draft/bank above: per-browser, in
   localStorage, nothing sent to the server.
   ============================================================ */

const SETTINGS_KEY = 'teststudio.settings.v1'

export type AppSettings = {
  defaultTimeLimit: string
  defaultShuffle: boolean
  defaultSingleAttempt: boolean
  exportIncludeTimestamps: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTimeLimit: '15m',
  defaultShuffle: true,
  defaultSingleAttempt: false,
  exportIncludeTimestamps: true,
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/* ============================================================
   Device id — a random per-browser identifier, used only to
   enforce a test's "single attempt" lock (lib/actions.ts —
   submitResponse, hasDeviceSubmitted). It is NOT an account: it
   identifies this browser profile, not a person. Clearing site
   data, using a different browser, or going incognito resets it —
   this is a same-device convenience lock, not a strong identity
   check, same as the original feature description promised.
   ============================================================ */

const DEVICE_KEY = 'teststudio.device.v1'

export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}