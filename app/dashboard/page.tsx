'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Clock3,
  Ellipsis,
  FilePenLine,
  HelpCircle,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Users,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton'
import {
  clearDraft,
  deleteServerDraft,
  loadDraft,
  saveDraft,
  saveServerDraft,
  typeMeta,
  type Test,
  type TestAttempt,
  type TestDraft,
  useDrafts,
  useTakenTests,
  useTests,
} from '@/lib/store'
import { useRouter } from 'next/navigation'

type Tab = 'tests' | 'taken' | 'drafts'

function formatPoints(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function formatSavedAt(value: number): string {
  const difference = Math.max(0, Date.now() - value)
  const minutes = Math.floor(difference / 60_000)
  if (minutes < 1) return 'Saved just now'
  if (minutes < 60) return `Saved ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Saved ${hours}h ago`
  return `Saved ${Math.floor(hours / 24)}d ago`
}

export default function DashboardPage() {
  const { tests, isLoading: testsLoading } = useTests()
  const { attempts, isLoading: attemptsLoading } = useTakenTests()
  const { drafts, isLoading: draftsLoading } = useDrafts()
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [tab, setTab] = useState<Tab>('tests')
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null)
  const [deletingDraft, setDeletingDraft] = useState(false)
  const [draftDeleteError, setDraftDeleteError] = useState<string | null>(null)

  const totalResponses = tests.reduce((sum, test) => sum + test.responses.length, 0)
  const selectedDraft = drafts.find((draft) => draft.id === draftToDelete) ?? null

  // Migrate the original browser-only draft as soon as its owner returns to
  // the dashboard after signing in. Subsequent autosaves use the returned
  // stable id, so this runs as an update rather than creating copies.
  useEffect(() => {
    const local = loadDraft()
    if (!local || (!local.title.trim() && local.questions.length === 0)) return
    const { id, savedAt: _savedAt, ...draft } = local
    void saveServerDraft(id ?? null, draft).then((result) => {
      if (result.ok) saveDraft({ ...draft, id: result.draft.id })
    })
  }, [])

  function handleJoin(event: React.FormEvent) {
    event.preventDefault()
    const code = joinCode.trim()
    if (code) router.push(`/take/${encodeURIComponent(code)}`)
  }

  async function handleDeleteDraft() {
    if (!selectedDraft || deletingDraft) return
    setDeletingDraft(true)
    setDraftDeleteError(null)
    try {
      const result = await deleteServerDraft(selectedDraft.id)
      if (!result.ok) {
        setDraftDeleteError(result.error)
        return
      }
      // Prevent a draft deliberately removed from the dashboard returning on
      // the next visit merely because this browser still had its cache.
      if (loadDraft()?.id === selectedDraft.id) clearDraft()
      setDraftToDelete(null)
    } catch {
      setDraftDeleteError('Unable to delete this draft. Please try again.')
    } finally {
      setDeletingDraft(false)
    }
  }

  if (testsLoading || attemptsLoading || draftsLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        right={
          <>
            <Link
              href="/create"
              className="flex items-center gap-2 rounded-[12px] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 sm:px-4"
            >
              <Plus className="size-4" aria-hidden />
              New test
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {tests.length} {tests.length === 1 ? 'test' : 'tests'} · {totalResponses}{' '}
            total {totalResponses === 1 ? 'response' : 'responses'}
          </p>
        </div>

        <form
          onSubmit={handleJoin}
          className="mb-7 flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Have a code? Take a test
          </div>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="AB3F-9K"
              aria-label="Test code"
              className="w-40 rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-sm uppercase text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              className="rounded-[10px] border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
            >
              Go
            </button>
          </div>
        </form>

        <div className="mb-6 flex overflow-x-auto border-b border-border" role="tablist" aria-label="Dashboard content">
          <TabButton active={tab === 'tests'} onClick={() => setTab('tests')}>
            Your Tests <span className="ml-1 font-mono text-xs">{tests.length}</span>
          </TabButton>
          <TabButton active={tab === 'taken'} onClick={() => setTab('taken')}>
            Test Taken <span className="ml-1 font-mono text-xs">{attempts.length}</span>
          </TabButton>
          <TabButton active={tab === 'drafts'} onClick={() => setTab('drafts')}>
            Drafts <span className="ml-1 font-mono text-xs">{drafts.length}</span>
          </TabButton>
        </div>

        {tab === 'tests' ? <YourTests tests={tests} /> : null}
        {tab === 'taken' ? <TakenTests attempts={attempts} /> : null}
        {tab === 'drafts' ? (
          <Drafts drafts={drafts} onRequestDelete={(draftId) => {
            setDraftDeleteError(null)
            setDraftToDelete(draftId)
          }} />
        ) : null}
      </main>

      {selectedDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete draft"
          onClick={() => !deletingDraft && setDraftToDelete(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-soft-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-1.5">
              <h2 className="font-heading text-base font-semibold text-foreground">Delete this draft?</h2>
              <p className="text-sm text-muted-foreground">
                “{selectedDraft.title || 'Untitled test'}” and its unfinished questions will be permanently removed.
              </p>
            </div>
            {draftDeleteError ? <p className="text-sm text-destructive">{draftDeleteError}</p> : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingDraft}
                onClick={() => setDraftToDelete(null)}
                className="rounded-[10px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingDraft}
                onClick={() => void handleDeleteDraft()}
                className="rounded-[10px] bg-destructive px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {deletingDraft ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function YourTests({ tests }: { tests: Test[] }) {
  if (tests.length === 0) {
    return <EmptyState icon={Plus} message="You haven't created any tests yet." action="Create your first test" href="/create" />
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tests.map((test) => (
        <article key={test.id} className="group relative flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-soft-lg">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 font-heading text-base font-semibold leading-snug text-foreground text-balance">
              {/* This link's ::before is stretched to cover the entire card
                  (see `before:absolute before:inset-0` below), so clicking
                  anywhere on the card opens the test — not just the title
                  text or the arrow row. The code badge and actions menu sit
                  in a `relative z-10` layer so they still intercept their
                  own clicks instead of triggering navigation. */}
              <Link
                href={`/test/${test.id}`}
                className="outline-none before:absolute before:inset-0 before:z-0 before:rounded-[16px] before:content-[''] focus-visible:before:ring-2 focus-visible:before:ring-primary/40"
              >
                {test.title}
              </Link>
            </h2>
            <div className="relative z-10 flex shrink-0 items-center gap-1">
              <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs text-accent-foreground">{test.code}</span>
              <TestActionsMenu testId={test.id} />
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><HelpCircle className="size-4" aria-hidden />{test.questions.length}</span>
              <span className="flex items-center gap-1.5"><Users className="size-4" aria-hidden />{test.responses.length}</span>
            </span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </div>
        </article>
      ))}
    </div>
  )
}

function TakenTests({ attempts }: { attempts: TestAttempt[] }) {
  if (attempts.length === 0) {
    return <EmptyState icon={Clock3} message="You haven't taken any tests yet." />
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {attempts.map((attempt) => (
        <article key={attempt.id} className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-semibold leading-snug text-foreground text-balance">{attempt.title}</h2>
              {attempt.code ? <p className="mt-1 font-mono text-xs text-muted-foreground">{attempt.code}</p> : null}
            </div>
            {attempt.needsGrading ? <span className="shrink-0 rounded-full bg-[var(--color-amber)]/15 px-2 py-1 text-xs text-[var(--color-amber)]">Needs grading</span> : null}
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{formatPoints(attempt.scoreEarned)} / {formatPoints(attempt.totalPossible)} · {attempt.percentage}%</span>
            <span>Taken {new Date(attempt.submittedAt).toLocaleDateString()} · Attempt {attempt.attemptNumber}</span>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Link href={`/results/${attempt.id}`} className="rounded-[10px] border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">View result</Link>
            {attempt.canRetake && attempt.retakeCode ? (
              <Link href={`/take/${encodeURIComponent(attempt.retakeCode)}`} className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"><RotateCcw className="size-3.5" aria-hidden />Retake test</Link>
            ) : attempt.singleAttempt ? (
              <span className="self-center text-xs text-muted-foreground">Retake unavailable · one attempt only</span>
            ) : (
              <span className="self-center text-xs text-muted-foreground">Retake unavailable</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function Drafts({
  drafts,
  onRequestDelete,
}: {
  drafts: TestDraft[]
  onRequestDelete: (id: string) => void
}) {
  if (drafts.length === 0) {
    return <EmptyState icon={FilePenLine} message="No drafts yet." detail="Start creating a test and we'll save your progress automatically." action="Create a test" href="/create" />
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {drafts.map((draft) => (
        <article key={draft.id} className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-semibold leading-snug text-foreground text-balance">{draft.title || 'Untitled test'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{draft.questions.length} {draft.questions.length === 1 ? 'question' : 'questions'} · {typeMeta(draft.questionType).label}</p>
            </div>
            <button type="button" onClick={() => onRequestDelete(draft.id)} aria-label={`Delete ${draft.title || 'draft'}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"><Trash2 className="size-3.5" aria-hidden /></button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5 text-primary" aria-hidden />Draft · {formatSavedAt(draft.updatedAt)}</div>
          <Link href={`/create?draft=${encodeURIComponent(draft.id)}`} className="mt-auto inline-flex w-fit items-center gap-2 rounded-[10px] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"><Pencil className="size-3.5" aria-hidden />Continue editing</Link>
        </article>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, message, detail, action, href }: { icon: typeof Plus; message: string; detail?: string; action?: string; href?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-border bg-card/50 px-6 py-20 text-center">
      <Icon className="size-6 text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {detail ? <p className="-mt-2 max-w-sm text-xs text-muted-foreground">{detail}</p> : null}
      {action && href ? <Link href={href} className="mt-1 flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"><Plus className="size-4" aria-hidden />{action}</Link> : null}
    </div>
  )
}

function TestActionsMenu({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(event: PointerEvent) { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [])
  return (
    <div ref={menuRef} className="relative">
      <button type="button" aria-label="Test actions" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><Ellipsis className="size-4" aria-hidden /></button>
      {open ? <div role="menu" aria-label="Test actions" className="absolute right-0 top-full z-20 mt-1 w-36 rounded-[10px] border border-border bg-card p-1 shadow-soft-lg"><Link href={`/create?edit=${encodeURIComponent(testId)}`} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-[7px] px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><Pencil className="size-3.5 text-primary" aria-hidden />Edit</Link></div> : null}
    </div>
  )
}
