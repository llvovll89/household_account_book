import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

// index.html의 인라인 테마 스크립트를 그대로 실행해 첫 페인트 전 테마 적용을 검증한다
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
const script = /<script id="theme-init">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

function runWith(saved: string | null, systemDark: boolean) {
  localStorage.clear()
  if (saved !== null) localStorage.setItem('hb_interface_theme', saved)
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark') && systemDark }))
  delete document.documentElement.dataset.theme
  new Function(script)()
  return document.documentElement.dataset.theme
}

afterEach(() => vi.unstubAllGlobals())

it('runs in <head> before the app script', () => {
  expect(script).not.toBe('')
  expect(html.indexOf('id="theme-init"')).toBeLessThan(html.indexOf('</head>'))
})

it('applies the saved theme, matching ThemeToggle', () => {
  expect(runWith('light', true)).toBe('light')
  expect(runWith('dark', false)).toBe('dark')
})

it('falls back to the system preference', () => {
  expect(runWith(null, false)).toBe('light')
  expect(runWith(null, true)).toBe('dark')
  expect(runWith('unknown', true)).toBe('dark')
})

it('never throws when storage is unavailable', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  expect(() => new Function(script)()).not.toThrow()
})
