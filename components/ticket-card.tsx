import { Clock, HelpCircle } from 'lucide-react'
import { TestQrCode } from '@/components/test-qr-code'

type TicketCardProps = {
  title?: string
  questionCount?: number
  timeLimit?: string
  code?: string
  qrUrl?: string
}

export function TicketCard({
  title = 'Cell Biology — Unit 4',
  questionCount = 10,
  timeLimit = '15 min',
  code = 'AB3F-9K',
  qrUrl,
}: TicketCardProps) {
  return (
    <div className="relative w-full max-w-lg rounded-[16px] border border-border bg-card shadow-soft-lg">
      {/* notches at the perforation */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-background" />

      <div className="grid grid-cols-[1fr_1px_1.1fr]">
        {/* left half — details */}
        <div className="flex flex-col justify-between gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Test ticket
            </span>
            <h3 className="font-heading text-lg font-semibold leading-snug text-foreground text-balance">
              {title}
            </h3>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" aria-hidden />
              {questionCount} questions
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-primary" aria-hidden />
              {timeLimit}
            </span>
          </div>
        </div>

        {/* perforation */}
        <div
          className="my-4 border-l border-dashed border-border"
          aria-hidden
        />

        {/* right half — code + QR */}
        <div className="flex flex-col items-center justify-center gap-3 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Share code
            </span>
            <span className="font-mono text-xl font-medium tracking-tight text-foreground sm:text-2xl">
              {code}
            </span>
          </div>

          {qrUrl ? (
            <TestQrCode
              url={qrUrl}
              filename={`${title.replace(/\s+/g, '-')}-qr.png`}
              size={104}
            />
          ) : (
            // decorative QR-like pattern, used only when there's no real
            // test behind this ticket (e.g. the marketing preview on the
            // landing page hero)
            <div
              className="grid size-16 grid-cols-5 grid-rows-5 gap-0.5 rounded-md border border-border bg-background p-1.5"
              aria-hidden
            >
              {QR_PATTERN.map((filled, i) => (
                <span
                  key={i}
                  className={filled ? 'rounded-[1px] bg-foreground' : ''}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// a fixed, decorative QR-like pattern (25 cells) — landing page only
const QR_PATTERN = [
  true, true, false, true, true,
  true, false, true, false, true,
  false, true, true, true, false,
  true, false, true, false, true,
  true, true, false, true, true,
]