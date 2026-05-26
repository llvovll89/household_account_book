import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target)
  const prevTargetRef = useRef(target)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const prev = prevTargetRef.current
    prevTargetRef.current = target

    if (prev === target) return

    const startTime = performance.now()
    const startValue = prev

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(startValue + (target - startValue) * eased))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
