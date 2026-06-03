import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('alert', vi.fn())
})
