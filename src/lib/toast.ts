type Handler = (msg: string, duration?: number) => void
let _handler: Handler | null = null

export function showToast(msg: string, duration = 2500) {
  _handler?.(msg, duration)
}

export function registerToastHandler(fn: Handler) {
  _handler = fn
  return () => { _handler = null }
}
