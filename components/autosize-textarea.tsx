'use client'

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react'

// useLayoutEffect warns during SSR since it can't run there. Next renders
// this 'use client' component on the server too, so fall back to
// useEffect outside the browser and keep the flash-free layout timing
// once we're actually in a DOM.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * A <textarea> that starts at one line and grows downward to fit its
 * content, then shrinks back as content is removed. Used anywhere free
 * text might wrap onto more than one line — question prompts, options,
 * explanations, short answers, etc. — instead of clipping text or
 * introducing a horizontal scrollbar. Every autosizing field in the app
 * should use this component rather than reimplementing the resize logic.
 */
export const AutosizeTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function AutosizeTextarea(
    { className = '', rows = 1, value, ...rest },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLTextAreaElement | null>(null)

    function setRefs(el: HTMLTextAreaElement | null) {
      localRef.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    }

    function resize(el: HTMLTextAreaElement | null) {
      if (!el) return
      // Collapse first so scrollHeight reflects content, not the
      // previous (possibly taller) box, then grow to fit.
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }

    // Recalculate on every value change — covers typing, pasting, and
    // programmatic updates (e.g. loading a saved test into the form).
    useIsomorphicLayoutEffect(() => {
      resize(localRef.current)
    }, [value])

    // Reflowing text (e.g. rotating a phone, resizing the window) can
    // change how many lines the same content wraps to.
    useEffect(() => {
      function handleResize() {
        resize(localRef.current)
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
      <textarea
        ref={setRefs}
        value={value}
        rows={rows}
        className={`resize-none overflow-hidden ${className}`}
        {...rest}
      />
    )
  },
)