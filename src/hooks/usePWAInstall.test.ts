import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePWAInstall } from './usePWAInstall'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })

it('does not interrupt first arrival and waits until save feedback ends', () => {
  const { result } = renderHook(usePWAInstall)
  act(() => { vi.advanceTimersByTime(10000) })
  expect(result.current.showInstallBanner).toBe(false)
  act(() => result.current.offerInstallAfterSave())
  act(() => { vi.advanceTimersByTime(6499) })
  expect(result.current.showInstallBanner).toBe(false)
  act(() => { vi.advanceTimersByTime(1) })
  expect(result.current.showInstallBanner).toBe(true)
})

it('respects snooze and legacy dismissal while allowing explicit help', () => {
  localStorage.setItem('pwa-install-prompt-dismissed', '1')
  const { result } = renderHook(usePWAInstall)
  act(() => { result.current.offerInstallAfterSave(); vi.advanceTimersByTime(10000) })
  expect(result.current.showInstallBanner).toBe(false)
  act(() => result.current.openInstallGuide())
  expect(result.current.showInstallBanner).toBe(true)
  act(() => result.current.closeInstallBanner())
  expect(Number(localStorage.getItem('hb_install_snooze_until'))).toBeGreaterThan(Date.now())
})

it('captures the browser prompt without showing it, then consumes it only on user action', async () => {
  const { result } = renderHook(usePWAInstall)
  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) })
  act(() => { window.dispatchEvent(event) })
  expect(event.defaultPrevented).toBe(true)
  expect(result.current.showInstallBanner).toBe(false)
  expect(prompt).not.toHaveBeenCalled()
  await act(async () => { await result.current.handleInstallClick() })
  expect(prompt).toHaveBeenCalledOnce()
  expect(result.current.deferredPrompt).toBeNull()
  expect(result.current.canInstall).toBe(false)
})

it('does not offer installation in standalone mode or after the installed event', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  const first = renderHook(usePWAInstall)
  act(() => { first.result.current.offerInstallAfterSave(); vi.advanceTimersByTime(10000) })
  expect(first.result.current.showInstallBanner).toBe(false)
  first.unmount()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  const { result } = renderHook(usePWAInstall)
  act(() => { result.current.offerInstallAfterSave(); window.dispatchEvent(new Event('appinstalled')); vi.advanceTimersByTime(10000) })
  expect(result.current.canInstall).toBe(false)
  expect(result.current.showInstallBanner).toBe(false)
})
