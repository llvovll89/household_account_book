import { useState, useCallback, useEffect, useRef } from 'react'

let modalLockCount = 0
let originalBodyOverflow = ''
let originalBodyPaddingRight = ''
let modalStackSeed = 0
const modalStack: number[] = []

interface UseModalCloseOptions {
  duration?: number
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function useModalClose(onClose: () => void, options: UseModalCloseOptions = {}) {
  const { duration = 200, initialFocusRef } = options
  const [closing, setClosing] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const isClosingRef = useRef(false)
  const modalIdRef = useRef<number>(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // onClose는 매 렌더마다 새 함수로 넘어오는 경우가 많다(인라인 콜백).
  // handleClose를 그 identity에 묶으면 아래 useEffect가 애니메이션 도중
  // 재실행되어 예약된 close 타이머가 취소되고, isClosingRef만 true로 남아
  // 모달이 다시는 닫히지 않는 채로 백드롭만 화면을 가리는 버그가 생긴다.
  const handleClose = useCallback(() => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setClosing(false)
      isClosingRef.current = false
      onCloseRef.current()
    }, duration)
  }, [duration])

  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    modalIdRef.current = ++modalStackSeed
    modalStack.push(modalIdRef.current)

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

    const focusTimer = window.requestAnimationFrame(() => {
      if (modalStack[modalStack.length - 1] !== modalIdRef.current) return
      const container = modalRef.current
      if (!container) return

      const preferred = initialFocusRef?.current
      if (preferred && container.contains(preferred) && !preferred.hasAttribute('disabled')) {
        preferred.focus({ preventScroll: true })
        return
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
      focusable[0]?.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== modalIdRef.current) return

      if (event.key === 'Escape') {
        event.preventDefault()
        handleCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const container = modalRef.current
      if (!container) return

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const isInside = !!active && container.contains(active)

      if (!isInside) {
        event.preventDefault()
        if (event.shiftKey) last.focus()
        else first.focus()
        return
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }

      const idx = modalStack.lastIndexOf(modalIdRef.current)
      if (idx !== -1) modalStack.splice(idx, 1)

      modalLockCount = Math.max(0, modalLockCount - 1)
      if (modalLockCount === 0) {
        body.style.overflow = originalBodyOverflow
        body.style.paddingRight = originalBodyPaddingRight
      }

      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus({ preventScroll: true })
      }
    }
    // handleClose는 위 handleCloseRef를 통해 참조하므로 의도적으로 deps에서 제외한다.
    // 이 effect는 모달이 실제로 마운트/언마운트될 때만 실행되어야 한다 — 그렇지 않으면
    // 애니메이션 도중 재실행되어 예약된 close 타이머가 취소되는 버그가 재발한다.
  }, [initialFocusRef])

  return { closing, handleClose, modalRef }
}
