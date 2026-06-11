export type ToastVariant = 'success' | 'warning' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

type Handler = (msg: string, duration?: number, variant?: ToastVariant, action?: ToastAction) => void
let _handler: Handler | null = null

export function showToast(msg: string, duration = 2500, variant: ToastVariant = 'success', action?: ToastAction) {
  _handler?.(msg, duration, variant, action)
}

export function registerToastHandler(fn: Handler) {
  _handler = fn
  return () => { _handler = null }
}
