'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, CameraOff, Loader2, QrCode, X } from 'lucide-react'
import { getPublicTestByCode } from '@/lib/actions'

type Phase =
  | 'starting'
  | 'scanning'
  | 'checking'
  | 'denied'
  | 'no-camera'
  | 'unsupported'
  | 'error'

function extractCode(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/take\/([^/?#]+)/i)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return trimmed
  }
}

export function QrScanDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  const [phase, setPhase] = useState<Phase>('starting')
  const [notice, setNotice] = useState<string | null>(null)
  const [slowHint, setSlowHint] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let stream: MediaStream | null = null
    let rafId: number | null = null
    let hintTimer: ReturnType<typeof setTimeout> | null = null
    let resumeTimer: ReturnType<typeof setTimeout> | null = null
    let paused = false

    setPhase('starting')
    setNotice(null)
    setSlowHint(false)

    function armHint() {
      if (hintTimer) clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setSlowHint(true), 8000)
    }

    function cleanup() {
      if (rafId) cancelAnimationFrame(rafId)
      if (hintTimer) clearTimeout(hintTimer)
      if (resumeTimer) clearTimeout(resumeTimer)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }

    async function handleDetected(text: string) {
      paused = true
      if (hintTimer) clearTimeout(hintTimer)
      setSlowHint(false)

      const candidate = extractCode(text)
      if (!candidate) {
        setNotice("That doesn't look like a TestStudio QR code.")
        resumeAfterDelay()
        return
      }

      setPhase('checking')
      try {
        const test = await getPublicTestByCode(candidate)
        if (cancelled) return
        if (test) {
          cleanup()
          onSuccessRef.current(test.code)
          return
        }
        setNotice(`No test found for code "${candidate.toUpperCase()}".`)
        setPhase('scanning')
        resumeAfterDelay()
      } catch {
        if (cancelled) return
        setNotice('Something went wrong checking that code. Try again.')
        setPhase('scanning')
        resumeAfterDelay()
      }
    }

    function resumeAfterDelay() {
      resumeTimer = setTimeout(() => {
        if (cancelled) return
        setNotice(null)
        paused = false
        armHint()
      }, 2000)
    }

    function tick() {
      if (cancelled) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (
        video &&
        canvas &&
        !paused &&
        video.readyState >= video.HAVE_CURRENT_DATA
      ) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (vw && vh) {
          const targetW = 320
          const targetH = Math.round((vh / vw) * targetW)
          if (canvas.width !== targetW) canvas.width = targetW
          if (canvas.height !== targetH) canvas.height = targetH
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetW, targetH)
            const imageData = ctx.getImageData(0, 0, targetW, targetH)
            const result = jsQR(imageData.data, targetW, targetH)
            if (result?.data) {
              handleDetected(result.data)
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('unsupported')
        return
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          await videoRef.current.play()
        }
        setPhase('scanning')
        armHint()
        tick()
      } catch (err) {
        if (cancelled) return
        const name = (err as { name?: string })?.name
        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          name === 'SecurityError'
        ) {
          setPhase('denied')
        } else if (
          name === 'NotFoundError' ||
          name === 'DevicesNotFoundError' ||
          name === 'OverconstrainedError'
        ) {
          setPhase('no-camera')
        } else {
          setPhase('error')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const showVideo = phase === 'scanning' || phase === 'checking'
  const showFallback =
    phase === 'denied' ||
    phase === 'no-camera' ||
    phase === 'unsupported' ||
    phase === 'error'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR code"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
            <QrCode className="size-4 text-primary" aria-hidden />
            Scan QR code
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

        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[12px] border border-border bg-background">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className={`size-full object-cover ${showVideo ? '' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {showVideo ? (
            <div className="pointer-events-none absolute inset-6 rounded-[10px]">
              <span className="absolute left-0 top-0 size-6 rounded-tl-[10px] border-l-2 border-t-2 border-primary" />
              <span className="absolute right-0 top-0 size-6 rounded-tr-[10px] border-r-2 border-t-2 border-primary" />
              <span className="absolute bottom-0 left-0 size-6 rounded-bl-[10px] border-b-2 border-l-2 border-primary" />
              <span className="absolute bottom-0 right-0 size-6 rounded-br-[10px] border-b-2 border-r-2 border-primary" />
            </div>
          ) : null}

          {phase === 'checking' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/85 px-6 text-center">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-foreground">Checking code…</p>
            </div>
          ) : null}

          {phase === 'starting' ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Requesting camera access…
              </p>
            </div>
          ) : null}

          {phase === 'denied' ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <CameraOff className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-foreground">Camera access denied.</p>
              <p className="text-xs text-muted-foreground">
                Enable camera permissions for this site in your browser
                settings, or enter the code manually instead.
              </p>
            </div>
          ) : null}

          {phase === 'no-camera' ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <CameraOff className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-foreground">No camera found.</p>
              <p className="text-xs text-muted-foreground">
                This device doesn&apos;t have a usable camera. Enter the code
                manually instead.
              </p>
            </div>
          ) : null}

          {phase === 'unsupported' ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <Camera className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-foreground">
                Scanning isn&apos;t supported here.
              </p>
              <p className="text-xs text-muted-foreground">
                Your browser doesn&apos;t support camera access. Enter the
                code manually instead.
              </p>
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <CameraOff className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-foreground">
                Couldn&apos;t start the camera.
              </p>
              <p className="text-xs text-muted-foreground">
                Enter the code manually instead.
              </p>
            </div>
          ) : null}
        </div>

        <div className="min-h-10 text-center">
          {notice ? (
            <p className="text-sm text-destructive">{notice}</p>
          ) : phase === 'scanning' ? (
            <p className="text-sm text-muted-foreground">
              {slowHint
                ? 'Still looking — make sure the code is well-lit and centered.'
                : 'Point your camera at a test QR code.'}
            </p>
          ) : null}
        </div>

        {showFallback ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
          >
            Enter code manually
          </button>
        ) : null}
      </div>
    </div>
  )
}