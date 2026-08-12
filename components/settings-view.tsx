'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Info } from 'lucide-react'
import { loadSettings, saveSettings, type AppSettings } from '@/lib/store'

/* ---------- small primitives ---------- */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
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
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap items-center gap-1 rounded-[10px] border border-border bg-background p-1"
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={`rounded-[7px] px-3 py-1 font-mono text-xs transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-soft">
      <div className="flex flex-col gap-1 px-4 pb-4 pt-6 sm:px-6">
        <h2 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function Row({
  label,
  description,
  control,
}: {
  label: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <div className="sm:shrink-0">{control}</div>
    </div>
  )
}

/* ---------- view ----------

   Everything below is real now — no toggle here is decorative.

   Removed from the old version, on purpose:
     - Export file format (CSV / JSON / PDF): only CSV export exists
       anywhere in this app. Offering JSON/PDF as choices when
       neither is implemented was exactly the "half-working feature"
       problem — it's been cut rather than faked.
     - Auto-export on close (email results): there's no email-sending
       code anywhere in this project, so this could never have worked
       as a toggle. Cut rather than left in as a dead switch.

   Kept, and made to actually do something:
     - Time limit / question-shuffle / choice-shuffle / single-attempt defaults now persist to
       this browser (localStorage) and genuinely pre-fill the
       create-test form — see app/create/page.tsx. You can still
       change any of them per test before publishing.
     - "Include submitted-at column" now actually controls the CSV
       export — see app/test/[id]/page.tsx.

   Added:
     - A plain note about this app having no accounts, since a
       teacher can otherwise lose every test they made with zero
       warning by clearing cookies. That's a real risk worth stating
       plainly, not a toggle. */

const TIME_OPTIONS = ['Off', '15m', '30m', '60m'] as const
type TimeOpt = (typeof TIME_OPTIONS)[number]

export function SettingsView() {
  const [timeLimit, setTimeLimit] = useState<TimeOpt>('15m')
  const [shuffle, setShuffle] = useState(true)
  const [shuffleChoices, setShuffleChoices] = useState(true)
  const [singleAttempt, setSingleAttempt] = useState(false)
  const [includeTimestamps, setIncludeTimestamps] = useState(true)
  const [saved, setSaved] = useState(false)

  // Load whatever's already saved on this browser, same pattern the
  // create-test draft loader uses.
  useEffect(() => {
    const s = loadSettings()
    setTimeLimit(s.defaultTimeLimit as TimeOpt)
    setShuffle(s.defaultShuffle)
    setShuffleChoices(s.defaultShuffleChoices)
    setSingleAttempt(s.defaultSingleAttempt)
    setIncludeTimestamps(s.exportIncludeTimestamps)
  }, [])

  function handleSave() {
    const next: AppSettings = {
      defaultTimeLimit: timeLimit,
      defaultShuffle: shuffle,
      defaultShuffleChoices: shuffleChoices,
      defaultSingleAttempt: singleAttempt,
      exportIncludeTimestamps: includeTimestamps,
    }
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Defaults for new tests"
        description="What a new test starts with. Change any of it per test on the create page before you publish."
      >
        <Row
          label="Time limit"
          description="Countdown shown once a test-taker starts — the test auto-submits when it runs out."
          control={
            <Segmented
              label="Default time limit"
              options={TIME_OPTIONS}
              value={timeLimit}
              onChange={setTimeLimit}
            />
          }
        />
        <Row
          label="Shuffle questions"
          description="Randomize question order for each test-taker."
          control={
            <Toggle
              label="Shuffle questions"
              checked={shuffle}
              onChange={setShuffle}
            />
          }
        />
        <Row
          label="Shuffle choices"
          description="Randomize multiple-choice options while keeping each answer correct."
          control={
            <Toggle
              label="Shuffle choices"
              checked={shuffleChoices}
              onChange={setShuffleChoices}
            />
          }
        />
        <Row
          label="Single-attempt lock"
          description="Once submitted, the same browser can't submit that test again."
          control={
            <Toggle
              label="Single-attempt lock"
              checked={singleAttempt}
              onChange={setSingleAttempt}
            />
          }
        />
      </Card>

      <Card
        title="Export preferences"
        description="Applied the next time you export a test's results as CSV."
      >
        <Row
          label="Include submitted-at column"
          description="Add the submission timestamp to each row."
          control={
            <Toggle
              label="Include submitted-at column"
              checked={includeTimestamps}
              onChange={setIncludeTimestamps}
            />
          }
        />
      </Card>

      <div className="flex items-start gap-3 rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">
          TestStudio doesn&apos;t use accounts — your tests, drafts, and
          question bank are tied to this browser only. Clearing cookies or
          site data, or switching browsers or devices, means losing access to
          them with no way to recover them. Bookmark your dashboard link if
          you want to come back later.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <Check className="size-4" aria-hidden />
            Changes saved
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          className="rounded-[12px] bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
