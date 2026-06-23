import { useState, useCallback, useEffect, useRef } from 'react'

let modalLockCount = 0
let originalBodyOverflow = ''
let originalBodyPaddingRight = ''

export function useModalClose(onClose: () => void, duration = 200) {
  const [closing, setClosing] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    const activeElement = document.activeElement
    triggerRef.current = activeElement instanceof HTMLElement ? activeElement : null

    const body = document.body
    modalLockCount += 1

    if (modalLockCount === 1) {
      originalBodyOverflow = body.style.overflow
      originalBodyPaddingRight = body.style.paddingRight
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`
      }
    }

    return () => {
      modalLockCount = Math.max(0, modalLockCount - 1)
      if (modalLockCount === 0) {
        body.style.overflow = originalBodyOverflow
        body.style.paddingRight = originalBodyPaddingRight
      }

      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus({ preventScroll: true })
      }
    }
  }, [])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, duration)
  }, [onClose, duration])

  return { closing, handleClose }
}
