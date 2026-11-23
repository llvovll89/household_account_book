import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { registerToastHandler, type ToastAction, type ToastVariant } from '../../lib/toast'

/** showToast()로 띄우는 앱 전역 토스트. App.tsx에서 옮겨 왔다 */
export function ToastHost() {
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success')
  const [toastAction, setToastAction] = useState<ToastAction | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unregister = registerToastHandler((msg, duration = 2500, variant = 'success', action) => {
      setToastMsg(msg)
      setToastVariant(variant)
      setToastAction(action ?? null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        setToastMsg(null)
        setToastAction(null)
      }, duration)
    })
    return () => {
      unregister?.()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  if (!toastMsg) return null
  return (
    <div
      role={toastVariant === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      className={`fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm ${toastAction ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <div className="flex items-center gap-3 bg-surface border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 shadow-xl">
        {toastVariant === 'success' && <CheckCircle2 size={16} className="text-income shrink-0" />}
        {toastVariant === 'warning' && <AlertTriangle size={16} className="text-warning shrink-0" />}
        {toastVariant === 'error' && <AlertTriangle size={16} className="text-expense shrink-0" />}
        {toastVariant === 'info' && <Info size={16} className="text-accent shrink-0" />}
        <p className="text-sm font-semibold text-white whitespace-pre-line flex-1">{toastMsg}</p>
        {toastAction && (
          <button
            onClick={() => {
              toastAction.onClick()
              setToastMsg(null)
              setToastAction(null)
            }}
            className="shrink-0 text-[13px] font-bold text-accent hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-tone-blue/10"
          >
            {toastAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
