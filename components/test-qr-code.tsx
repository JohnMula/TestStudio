'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Loader2 } from 'lucide-react'

export function TestQrCode({
  url,
  filename,
  size = 152,
}: {
  url: string
  filename: string
  size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!url || !canvasRef.current) return
    setReady(false)
    QRCode.toCanvas(
      canvasRef.current,
      url,
      {
        width: size,
        margin: 1,
        color: { dark: '#18181b', light: '#ffffff' },
      },
      (err) => {
        if (!err) setReady(true)
      },
    )
  }, [url, size])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-[12px] border border-border bg-background p-3">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="QR code that opens this test"
          style={{ width: size, height: size }}
        />
        {!ready ? (
          <Loader2
            className="absolute size-5 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!ready}
        className="flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="size-3.5" aria-hidden />
        Download QR
      </button>
    </div>
  )
}