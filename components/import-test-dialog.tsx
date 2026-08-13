'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Check, Clipboard, FileJson, Upload, X } from 'lucide-react'
import { QUESTION_TYPES } from '@/lib/types'
import {
  DEFAULT_AI_IMPORT_PROMPT,
  MAX_JSON_IMPORT_BYTES,
  parseTestStudioImport,
  type ImportedTest,
} from '@/lib/test-import'

const textareaClass =
  'w-full rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

function formatFileLimit(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

function questionTypeSummary(test: ImportedTest): string[] {
  const counts = new Map<string, number>()
  for (const question of test.questions) {
    counts.set(question.type, (counts.get(question.type) ?? 0) + 1)
  }
  return QUESTION_TYPES.flatMap((type) => {
    const count = counts.get(type.type)
    return count ? [`${count} ${type.label}`] : []
  })
}

export function ImportTestDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (test: ImportedTest) => Promise<string | null>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState(DEFAULT_AI_IMPORT_PROMPT)
  const [showMore, setShowMore] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedTest, setSelectedTest] = useState<ImportedTest | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [importing, setImporting] = useState(false)

  if (!open) return null

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setCopyState('error')
    }
  }

  async function selectFile(file: File | undefined) {
    setError(null)
    setSelectedTest(null)
    setFileName(null)

    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Upload a TestStudio JSON file with a .json extension.')
      return
    }
    if (file.size > MAX_JSON_IMPORT_BYTES) {
      setError(`This JSON file is too large. Upload a file smaller than ${formatFileLimit(MAX_JSON_IMPORT_BYTES)}.`)
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      setError('We could not read that file. Please choose another JSON file.')
      return
    }
    const parsed = parseTestStudioImport(text)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setSelectedTest(parsed.test)
    setFileName(file.name)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (event.dataTransfer.types.includes('Files')) setIsDragging(true)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const [file] = Array.from(event.dataTransfer.files)
    void selectFile(file)
  }

  async function confirmImport() {
    if (!selectedTest || importing) return
    setImporting(true)
    setError(null)
    const importError = await onImport(selectedTest)
    if (importError) {
      setError(importError)
      setImporting(false)
      return
    }
    setImporting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-test-title"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-[16px] border border-border bg-card p-5 shadow-soft-lg sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-primary">
              <FileJson className="size-4" aria-hidden />
            </span>
            <div>
              <h2
                id="import-test-title"
                className="font-heading text-lg font-semibold tracking-tight text-foreground"
              >
                Import Test from JSON
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Use an external AI to create a TestStudio JSON file, then review it here as a draft.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">AI prompt</span>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              {copyState === 'copied' ? (
                <Check className="size-3.5 text-primary" aria-hidden />
              ) : (
                <Clipboard className="size-3.5 text-primary" aria-hidden />
              )}
              {copyState === 'copied'
                ? 'Copied!'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy prompt'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            Edit the request or any part of this prompt before copying it into ChatGPT, Gemini, Claude, or another AI.
          </p>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={showMore ? 24 : 7}
            aria-label="Editable AI prompt"
            className={`${textareaClass} resize-y overflow-y-auto`}
          />
          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="self-start text-sm font-medium text-primary transition-opacity hover:opacity-80"
          >
            {showMore ? 'Show less' : 'Show more'}
          </button>
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <div>
            <span className="text-sm font-medium text-foreground">Upload JSON</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload only the JSON returned by the AI. Files are checked before anything is added to your draft.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleFileChange}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a JSON file"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed px-5 py-6 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-secondary/70'
                : 'border-border bg-background/50 hover:border-primary/60 hover:bg-secondary/40'
            }`}
          >
            <Upload className="size-5 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">Drag and drop a JSON file here</span>
            <span className="text-sm text-muted-foreground">or click to browse</span>
            <span className="font-mono text-xs text-muted-foreground">.json · up to {formatFileLimit(MAX_JSON_IMPORT_BYTES)}</span>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </section>

        {selectedTest ? (
          <section className="flex flex-col gap-3 rounded-[12px] border border-border bg-secondary/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Imported test</span>
              {fileName ? <span className="font-mono text-xs text-muted-foreground">{fileName}</span> : null}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Title</dt>
                <dd className="mt-0.5 font-medium text-foreground">{selectedTest.title}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Questions</dt>
                <dd className="mt-0.5 font-medium text-foreground">{selectedTest.questions.length}</dd>
              </div>
              {selectedTest.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Description</dt>
                  <dd className="mt-0.5 text-foreground text-pretty">{selectedTest.description}</dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Question types</dt>
                <dd className="mt-0.5 text-foreground">{questionTypeSummary(selectedTest).join(' · ')}</dd>
              </div>
            </dl>
            <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedTest(null)
                  setFileName(null)
                }}
                disabled={importing}
                className="rounded-[10px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={importing}
                className="rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? 'Importing…' : 'Import test'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
