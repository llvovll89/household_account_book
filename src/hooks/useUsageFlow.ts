import { useCallback, useEffect, useRef } from 'react'
import { beginUsageFlow, updateUsageFlow } from '../lib/usageFlow'
import type { UsageFlow, UsageStage } from '../lib/usageFlow'

export function useUsageFlow(flow: UsageFlow, active = true) {
  const idRef = useRef<string | null>(null)
  const submittedRef = useRef(false)
  const ensure = useCallback(() => {
    if (!active) return null
    if (!idRef.current) idRef.current = beginUsageFlow(flow)
    return idRef.current
  }, [flow, active])
  useEffect(() => {
    if (!active) return
    // StrictMode's simulated mount is cancelled before it records a flow.
    const timer = setTimeout(ensure, 0)
    const close = () => {
      if (!submittedRef.current) updateUsageFlow(idRef.current, 'abandon')
    }
    const resume = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      idRef.current = null
      submittedRef.current = false
      ensure()
    }
    window.addEventListener('pagehide', close)
    window.addEventListener('pageshow', resume)
    return () => {
      clearTimeout(timer)
      close()
      idRef.current = null
      window.removeEventListener('pagehide', close)
      window.removeEventListener('pageshow', resume)
    }
  }, [active, ensure])
  const step = useCallback((stage: UsageStage) => updateUsageFlow(ensure(), 'step', stage), [ensure])
  const error = useCallback((stage: UsageStage) => updateUsageFlow(ensure(), 'error', stage), [ensure])
  const submit = useCallback(() => {
    const id = ensure()
    submittedRef.current = true
    updateUsageFlow(id, 'submit', 'persist')
    return id
  }, [ensure])
  return { step, error, submit }
}
