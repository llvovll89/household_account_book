import { useEffect, useRef } from 'react'

/** Keep the sheet inside the visible screen when a mobile keyboard opens. */
export function useVisualViewport() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const element = ref.current
      if (!element) return
      element.style.height = `${viewport.height}px`
      element.style.top = `${viewport.offsetTop}px`
      element.style.bottom = 'auto'
      element.dataset.keyboard = String(window.innerHeight - viewport.height > 150)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return ref
}
