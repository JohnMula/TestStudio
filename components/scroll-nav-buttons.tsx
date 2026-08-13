'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

// The buttons only show up once there's enough content on the page to make
// scrolling worth it — a short test with one or two questions never
// triggers them.
const SCROLL_THRESHOLD = 240

const buttonCls =
  'flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft-lg transition-colors hover:bg-secondary active:scale-95 sm:size-12'

/**
 * Floating "scroll to top" / "scroll to bottom" buttons for long pages, e.g.
 * a test with many questions. Fixed to the side of the viewport, vertically
 * centered so it never overlaps a sticky header or bottom action bar. Sized
 * for comfortable tapping on phones, tablets, and iPads (44px+ targets).
 */
export function ScrollNavButtons() {
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateVisibility = useCallback(() => {
    const scrollY = window.scrollY
    const viewport = window.innerHeight
    const pageHeight = document.documentElement.scrollHeight

    setCanScrollUp(scrollY > SCROLL_THRESHOLD)
    setCanScrollDown(scrollY + viewport < pageHeight - SCROLL_THRESHOLD)
  }, [])

  useEffect(() => {
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)

    // Questions can be added, removed, or expanded without the window
    // itself firing a scroll/resize event, so also watch the page's own
    // height directly.
    const resizeObserver = new ResizeObserver(updateVisibility)
    resizeObserver.observe(document.body)

    return () => {
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
      resizeObserver.disconnect()
    }
  }, [updateVisibility])

  if (!canScrollUp && !canScrollDown) return null

  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2 sm:right-5 md:right-8">
      {canScrollUp ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          className={buttonCls}
        >
          <ChevronUp className="size-5 text-primary" aria-hidden />
        </button>
      ) : null}
      {canScrollDown ? (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
          }
          aria-label="Scroll to bottom"
          className={buttonCls}
        >
          <ChevronDown className="size-5 text-primary" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}