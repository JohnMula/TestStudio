'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Eye, Library, Check, X, Plus, Calendar, Upload } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { TypePicker } from '@/components/type-picker'
import { QuestionEditor } from '@/components/question-editor'
import { BankDialog } from '@/components/bank-dialog'
import { PreviewDialog } from '@/components/preview-dialog'
import { AutosizeTextarea } from '@/components/autosize-textarea'
import { ImportTestDialog } from '@/components/import-test-dialog'
import { ScrollNavButtons } from '@/components/scroll-nav-buttons'
import type { ImportedTest } from '@/lib/test-import'
import {
  createTest,
  updateTest,
  blankQuestion,
  deleteServerDraft,
  getDraftForEditing,
  saveDraft,
  saveServerDraft,
  loadDraft,
  clearDraft,
  saveToBank,
  possiblePoints,
  loadSettings,
  getTestForEditing,
  type Question,
  type QType,
  type DraftData,
  type Test,
} from '@/lib/store'

const TIME_OPTIONS = ['Off', '15m', '30m', '60m'] as const
type TimeOpt = (typeof TIME_OPTIONS)[number]

const fieldCls =
  'rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

function toLocalInput(ms: number | null): string {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function CreateEditor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const requestedDraftId = searchParams.get('draft')
  const isEditing = Boolean(editId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimit, setTimeLimit] = useState<TimeOpt>('15m')
  const [shuffle, setShuffle] = useState(true)
  const [shuffleChoices, setShuffleChoices] = useState(true)
  const [singleAttempt, setSingleAttempt] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionType, setQuestionType] = useState<QType>('multiple_choice')

  const [customCode, setCustomCode] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
  const [bankTarget, setBankTarget] = useState<Question | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [autosaveState, setAutosaveState] = useState<
    'idle' | 'saving' | 'saved' | 'local' | 'error'
  >('idle')
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const draftIdRef = useRef<string | null>(null)
  const discardDraftRef = useRef(false)

  /* ---------- autosave: load once, then persist on change ---------- */
  useEffect(() => {
    let active = true

    async function initialize() {
      setLoaded(false)
      setLoadError(null)

      if (editId) {
        try {
          const test = await getTestForEditing(editId)
          if (!active) return
          if (!test) {
            setLoadError(
              'This test could not be found or you no longer have permission to edit it.',
            )
            return
          }

          setTitle(test.title)
          setDescription(test.description)
          setCustomCode(test.code)
          setTimeLimit(
            TIME_OPTIONS.includes(test.timeLimit as TimeOpt)
              ? (test.timeLimit as TimeOpt)
              : '15m',
          )
          setShuffle(test.shuffle)
          setShuffleChoices(test.shuffleChoices)
          setSingleAttempt(test.singleAttempt)
          setQuestions(test.questions)
          setOpensAt(toLocalInput(test.opensAt ?? null))
          setClosesAt(toLocalInput(test.closesAt ?? null))
          const lastQuestion = test.questions[test.questions.length - 1]
          if (lastQuestion) setQuestionType(lastQuestion.type)
        } catch {
          if (active) {
            setLoadError('Unable to load this test. Please try again.')
          }
        } finally {
          if (active) setLoaded(true)
        }
        return
      }

      if (requestedDraftId) {
        try {
          const draft = await getDraftForEditing(requestedDraftId)
          if (!active) return
          if (!draft) {
            setLoadError('This draft could not be found or you no longer have permission to open it.')
            return
          }
          draftIdRef.current = draft.id
          setTitle(draft.title)
          setDescription(draft.description)
          setCustomCode(draft.code)
          setTimeLimit((draft.timeLimit as TimeOpt) ?? '15m')
          setShuffle(draft.shuffle)
          setShuffleChoices(draft.shuffleChoices)
          setSingleAttempt(draft.singleAttempt)
          setQuestions(draft.questions)
          setOpensAt(toLocalInput(draft.opensAt))
          setClosesAt(toLocalInput(draft.closesAt))
          setQuestionType(draft.questionType)
          setSavedAt(draft.updatedAt)
          setAutosaveState('saved')
          saveDraft({
            id: draft.id,
            title: draft.title,
            description: draft.description,
            code: draft.code,
            timeLimit: draft.timeLimit,
            shuffle: draft.shuffle,
            shuffleChoices: draft.shuffleChoices,
            singleAttempt: draft.singleAttempt,
            questionType: draft.questionType,
            questions: draft.questions,
            opensAt: draft.opensAt,
            closesAt: draft.closesAt,
          })
        } catch {
          if (active) setLoadError('Unable to load this draft. Please try again.')
        } finally {
          if (active) setLoaded(true)
        }
        return
      }

    const d = loadDraft()
    if (d) {
      draftIdRef.current = d.id ?? null
      setTitle(d.title)
      setDescription(d.description ?? '')
      setCustomCode(d.code ?? '')
      setTimeLimit((d.timeLimit as TimeOpt) ?? '15m')
      setShuffle(d.shuffle)
      setShuffleChoices(d.shuffleChoices)
      setSingleAttempt(d.singleAttempt)
      setQuestions(d.questions)
      setOpensAt(toLocalInput(d.opensAt))
      setClosesAt(toLocalInput(d.closesAt))
      setQuestionType(d.questionType)
      setSavedAt(d.savedAt)
    } else {
      // No draft yet — start from this browser's saved defaults
      // (Settings page) instead of the hardcoded fallbacks.
      const s = loadSettings()
      setTimeLimit(s.defaultTimeLimit as TimeOpt)
      setShuffle(s.defaultShuffle)
      setShuffleChoices(s.defaultShuffleChoices)
      setSingleAttempt(s.defaultSingleAttempt)
    }
      if (active) setLoaded(true)
    }

    void initialize()
    return () => {
      active = false
    }
  }, [editId, requestedDraftId])

  useEffect(() => {
    if (!loaded || isEditing) return
    const t = setTimeout(() => {
      const draft = {
        title,
        description,
        code: customCode,
        timeLimit,
        shuffle,
        shuffleChoices,
        singleAttempt,
        questionType,
        questions,
        opensAt: opensAt ? new Date(opensAt).getTime() : null,
        closesAt: closesAt ? new Date(closesAt).getTime() : null,
      }
      if (!draft.title.trim() && draft.questions.length === 0) return

      // Keep a browser cache first, then synchronise the same stable draft id
      // to Supabase. A temporary connection problem never discards edits.
      if (!draftIdRef.current && typeof crypto !== 'undefined') {
        draftIdRef.current = crypto.randomUUID()
      }
      saveDraft({
        ...draft,
        ...(draftIdRef.current ? { id: draftIdRef.current } : {}),
      })
      setSavedAt(Date.now())
      setAutosaveState('saving')
      setAutosaveError(null)
      void saveServerDraft(draftIdRef.current, draft)
        .then((result) => {
          if (result.ok) {
            draftIdRef.current = result.draft.id
            if (discardDraftRef.current) {
              void deleteServerDraft(result.draft.id)
              return
            }
            saveDraft({ ...draft, id: result.draft.id })
            setSavedAt(result.draft.updatedAt)
            setAutosaveState('saved')
            return
          }
          if (result.needsSignIn) {
            setSavedAt(Date.now())
            setAutosaveState('local')
            return
          }
          setAutosaveState('error')
          setAutosaveError(result.error)
        })
        .catch(() => {
          setAutosaveState('error')
          setAutosaveError(
            'Unable to save this draft. Your latest changes remain on this device.',
          )
        })
    }, 1200)
    return () => clearTimeout(t)
  }, [
    loaded,
    title,
    description,
    customCode,
    timeLimit,
    shuffle,
    shuffleChoices,
    singleAttempt,
    questionType,
    questions,
    opensAt,
    closesAt,
    isEditing,
  ])

  /* ---------- question mutations ---------- */
  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion(questionType)])
  }
  function updateQuestion(q: Question) {
    setQuestions((qs) => qs.map((x) => (x.id === q.id ? q : x)))
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((x) => x.id !== id))
  }
  function insertMany(items: Question[]) {
    setQuestions((qs) => [...qs, ...items])
  }

  /* ---------- drag reorder (pointer-based) ---------- */
  const dragIndex = useRef<number | null>(null)
  const handleMove = useCallback((e: PointerEvent) => {
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('[data-qcard]')
    if (!el) return
    const to = Number(el.getAttribute('data-qcard'))
    const from = dragIndex.current
    if (from === null || Number.isNaN(to) || to === from) return
    setQuestions((qs) => {
      const next = [...qs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    dragIndex.current = to
  }, [])
  const handleUp = useCallback(() => {
    dragIndex.current = null
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
  }, [handleMove])
  const startDrag = useCallback(
    (index: number) => {
      dragIndex.current = index
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [handleMove, handleUp],
  )

  function requestSaveToBank(q: Question) {
    setBankTarget(q)
  }

  async function importTest(imported: ImportedTest): Promise<string | null> {
    const questionType =
      imported.questions[imported.questions.length - 1]?.type ?? 'multiple_choice'
    const draft: DraftData = {
      title: imported.title,
      description: imported.description,
      code: '',
      timeLimit,
      shuffle,
      shuffleChoices,
      singleAttempt,
      questionType,
      questions: imported.questions,
      opensAt: null,
      closesAt: null,
    }
    const newDraftId = typeof crypto !== 'undefined' ? crypto.randomUUID() : null

    try {
      const result = await saveServerDraft(newDraftId, draft)
      if (result.ok) {
        saveDraft({ ...draft, id: result.draft.id })
        setImportOpen(false)
        router.push(`/create?draft=${encodeURIComponent(result.draft.id)}`)
        return null
      }
      if (!result.needsSignIn) return result.error
    } catch {
      // Anonymous creators can still use the browser-local draft flow.
    }

    draftIdRef.current = newDraftId
    discardDraftRef.current = false
    saveDraft({ ...draft, ...(newDraftId ? { id: newDraftId } : {}) })
    setTitle(draft.title)
    setDescription(draft.description)
    setCustomCode(draft.code)
    setTimeLimit(draft.timeLimit as TimeOpt)
    setShuffle(draft.shuffle)
    setShuffleChoices(draft.shuffleChoices)
    setSingleAttempt(draft.singleAttempt)
    setQuestionType(draft.questionType)
    setQuestions(draft.questions)
    setOpensAt('')
    setClosesAt('')
    setSavedAt(Date.now())
    setAutosaveState('local')
    setAutosaveError(null)
    setImportOpen(false)
    return null
  }

  /* ---------- publish ---------- */
  const canPublish =
    title.trim().length > 0 && questions.length > 0 && !publishing
  const totalPoints = possiblePoints({ questions } as Test)

  async function handlePublish() {
    if (!canPublish) return
    setPublishing(true)
    setPublishError(null)
    const input = {
      title: title.trim(),
      description: description.trim(),
      code: customCode.trim() ? customCode.trim() : undefined,
      timeLimit,
      shuffle,
      shuffleChoices,
      singleAttempt,
      questions,
      opensAt: opensAt ? new Date(opensAt).getTime() : null,
      closesAt: closesAt ? new Date(closesAt).getTime() : null,
    }
    let res: Awaited<ReturnType<typeof createTest>>
    try {
      res = isEditing && editId
        ? await updateTest(editId, input)
        : await createTest(input)
    } catch {
      setPublishError(
        isEditing
          ? 'Unable to save your changes. Please try again.'
          : 'Unable to publish this test. Please try again.',
      )
      setPublishing(false)
      return
    }
    if (!res.ok) {
      setPublishError(res.error)
      setPublishing(false)
      return
    }
    if (!isEditing) {
      discardDraftRef.current = true
      const draftId = draftIdRef.current
      clearDraft()
      // Publishing is already durable at this point; a failed cleanup should
      // not turn a published test into an apparent failure. The dashboard
      // revalidates after the best-effort delete.
      if (draftId) void deleteServerDraft(draftId)
    }
    router.push(`/test/${res.id}?${isEditing ? 'updated' : 'created'}=1`)
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        maxWidth="max-w-3xl"
        right={
          <div className="flex items-center gap-4">
            {!isEditing && (autosaveState === 'saving' || savedAt) ? (
              <span
                className={`hidden items-center gap-1.5 font-mono text-xs sm:flex ${
                  autosaveState === 'error' ? 'text-destructive' : 'text-muted-foreground'
                }`}
                title={autosaveError ?? undefined}
              >
                {autosaveState === 'saving' ? (
                  <span className="size-3 animate-spin rounded-full border border-secondary border-t-primary" />
                ) : (
                  <Check className="size-3.5 text-primary" aria-hidden />
                )}
                {autosaveState === 'saving'
                  ? 'Saving…'
                  : autosaveState === 'local'
                    ? 'Saved on this device'
                    : autosaveState === 'error'
                      ? 'Draft save failed'
                      : 'Autosaved'}
              </span>
            ) : null}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Dashboard
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {!loaded ? (
          <div className="flex flex-col items-center gap-3 rounded-[16px] border border-border bg-card px-6 py-20 text-center shadow-soft">
            <span className="size-5 animate-spin rounded-full border-2 border-secondary border-t-primary" />
            <p className="text-sm text-muted-foreground">
              {isEditing ? 'Loading test…' : 'Loading editor…'}
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-4 rounded-[16px] border border-border bg-card px-6 py-20 text-center shadow-soft">
            <p className="text-sm text-destructive">{loadError}</p>
            <Link
              href="/dashboard"
              className="rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {isEditing ? 'Edit test' : 'Create a test'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mix any question types you like. Publish, then share the code — no
            account needed to take it.
          </p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex w-fit shrink-0 items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              <Upload className="size-4 text-primary" aria-hidden />
              Upload JSON
            </button>
          ) : null}
        </div>

        {/* details */}
        <section className="mb-6 flex flex-col gap-5 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Test title</span>
            <AutosizeTextarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cell Biology — Unit 4"
              className={fieldCls}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Test description <span className="text-muted-foreground">(optional)</span>
            </span>
            <AutosizeTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short introduction or instruction for test-takers"
              className={fieldCls}
            />
          </label>

          <TypePicker value={questionType} onChange={setQuestionType} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Time limit</span>
            <div className="flex items-center gap-1 self-start rounded-[10px] border border-border bg-background p-1">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTimeLimit(opt)}
                  className={`rounded-[7px] px-3 py-1 font-mono text-xs transition-colors ${
                    opt === timeLimit
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="Shuffle questions"
            description="Randomize order for each test-taker."
            checked={shuffle}
            onChange={setShuffle}
          />
          <ToggleRow
            label="Shuffle choices"
            description="Randomize multiple-choice options while keeping each answer correct."
            checked={shuffleChoices}
            onChange={setShuffleChoices}
          />
          <ToggleRow
            label="Single attempt"
            description="A code can't be reused from the same device once submitted."
            checked={singleAttempt}
            onChange={setSingleAttempt}
          />
        </section>

        {/* sharing, scheduling & branding — available to everyone */}
        <section className="mb-6 flex flex-col gap-5 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-6">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Sharing &amp; scheduling
          </span>
          <p className="-mt-2 text-xs text-muted-foreground text-pretty">
            Set a memorable code and an optional open/close window. No account
            needed to take the test.
          </p>

          {/* custom code */}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Custom share code
            </span>
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="e.g. mrsmith-algebra1 — or leave blank for a random one"
              className={`${fieldCls} font-mono`}
            />
          </label>

          {/* scheduling */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="size-3.5 text-primary" aria-hidden />
                Auto-open
              </span>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className={`${fieldCls} w-full`}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="size-3.5 text-primary" aria-hidden />
                Auto-close
              </span>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={`${fieldCls} w-full`}
              />
            </label>
          </div>
        </section>

        {/* assist bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBankOpen(true)}
            className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
          >
            <Library className="size-4 text-primary" aria-hidden />
            Question bank
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={questions.length === 0}
            className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="size-4 text-primary" aria-hidden />
            Preview as test-taker
          </button>
        </div>

        {/* questions */}
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={q.id} data-qcard={i}>
              <QuestionEditor
                question={q}
                index={i}
                onChange={updateQuestion}
                onRemove={() => removeQuestion(q.id)}
                onSaveToBank={() => requestSaveToBank(q)}
                onHandlePointerDown={() => startDrag(i)}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Add question
          </button>
        </div>

        {questions.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Add your first question — pick any type. Mix and match freely.
          </p>
        ) : null}

        {/* publish bar */}
        <div className="sticky bottom-4 mt-8 flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4 shadow-soft-lg sm:bottom-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="text-sm text-muted-foreground text-pretty">
            {publishError ? (
              <span className="text-destructive">{publishError}</span>
            ) : (
              <>
                {questions.length}{' '}
                {questions.length === 1 ? 'question' : 'questions'} ·{' '}
                {totalPoints} {totalPoints === 1 ? 'pt' : 'pts'}
                {title.trim().length === 0 || questions.length === 0
                  ? ' · add a title and a question to publish'
                  : ' · ready to share'}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="w-full shrink-0 rounded-[12px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:py-2.5"
          >
            {publishing
              ? isEditing
                ? 'Saving…'
                : 'Publishing…'
              : isEditing
                ? 'Save changes'
                : 'Publish test'}
          </button>
        </div>
          </>
        )}
      </main>

      {/* dialogs */}
      <PreviewDialog
        open={previewOpen}
        title={title}
        description={description}
        questions={questions}
        onClose={() => setPreviewOpen(false)}
      />
      <BankDialog
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        onInsert={(q) => {
          insertMany([q])
          setBankOpen(false)
        }}
      />
      <SubjectDialog
        question={bankTarget}
        onClose={() => setBankTarget(null)}
        onSave={(subject, q) => {
          saveToBank(subject, q)
          setBankTarget(null)
        }}
      />
      <ImportTestDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importTest}
      />
      <ScrollNavButtons />
    </div>
  )
}

export default function CreatePage() {
  return (
    <Suspense fallback={<EditorLoadingFallback />}>
      <CreateEditor />
    </Suspense>
  )
}

function EditorLoadingFallback() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col items-center gap-3 rounded-[16px] border border-border bg-card px-6 py-20 text-center shadow-soft">
          <span className="size-5 animate-spin rounded-full border-2 border-secondary border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading editor…</p>
        </div>
      </main>
    </div>
  )
}

/* ---------- inline helpers ---------- */

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground text-pretty">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-secondary'
        }`}
      >
        <span
          className={`inline-block size-4 rounded-full bg-card shadow-soft transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function SubjectDialog({
  question,
  onClose,
  onSave,
}: {
  question: Question | null
  onClose: () => void
  onSave: (subject: string, q: Question) => void
}) {
  const [subject, setSubject] = useState('')
  if (!question) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save to question bank"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
            <Library className="size-4 text-primary" aria-hidden />
            Save to bank
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Subject tag
          <input
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Biology"
            className={fieldCls}
          />
        </label>
        <button
          type="button"
          onClick={() => onSave(subject.trim() || 'General', question)}
          className="rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
        >
          Save question
        </button>
      </div>
    </div>
  )
}
