import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { HeaderMenu } from './HeaderMenu'

afterEach(cleanup)

const handlers = () => ({
  onOpenImport: vi.fn(), onOpenPaymentMethods: vi.fn(), onOpenAutoCategoryRules: vi.fn(), onOpenBackup: vi.fn(),
  onReset: vi.fn(), onLogout: vi.fn(), onLogin: vi.fn(), onPrefetchImport: vi.fn(),
})

it('offers the same tools when signed out, plus a login button, and closes after a choice', () => {
  const h = handlers()
  render(createElement(HeaderMenu, { user: null, ...h }))
  fireEvent.click(screen.getByRole('button', { name: '로그인 모달 열기' }))
  expect(h.onLogin).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
  expect(screen.queryByRole('button', { name: /로그아웃/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /백업·복원/ }))
  expect(h.onOpenBackup).toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /가져오기/ })).toBeNull()
})

it('shows the account and logout when signed in', () => {
  const h = handlers()
  render(createElement(HeaderMenu, { user: { email: 'a@b.c', photoURL: null } as User, ...h }))
  expect(screen.queryByRole('button', { name: '로그인 모달 열기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
  expect(screen.getByText('a@b.c')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
  expect(h.onLogout).toHaveBeenCalled()
})
