export type ToastVariant = 'success' | 'warning' | 'error' | 'info'

type Handler = (msg: string, duration?: number, variant?: ToastVariant) => void
let _handler: Handler | null = null

export function showToast(msg: string, duration = 2500, variant: ToastVariant = 'success') {
  _handler?.(msg, duration, variant)
}

export function registerToastHandler(fn: Handler) {
  _handler = fn
  return () => { _handler = null }
}
