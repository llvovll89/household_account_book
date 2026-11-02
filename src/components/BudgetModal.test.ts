import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import BudgetModal from './BudgetModal'

it('edits actual default values when switching from an overridden month and saves its carryover setting', () => {
  const onSave = vi.fn()
  render(createElement(BudgetModal, {
    budgets: [{ category: '식비', limit: 30000, carryover: false }],
    baseBudgets: [{ category: '식비', limit: 40000, carryover: true }],
    hasMonthOverride: true, yearMonth: '2026-11', onSave, onClose: vi.fn(),
  }))
  expect((screen.getByRole('textbox', { name: '식비 예산' }) as HTMLInputElement).value).toBe('30,000')
  fireEvent.click(screen.getByRole('button', { name: '전체 (기본값)' }))
  expect((screen.getByRole('textbox', { name: '식비 예산' }) as HTMLInputElement).value).toBe('40,000')
  fireEvent.click(screen.getByRole('button', { name: '2026년 11월만' }))
  expect((screen.getByRole('textbox', { name: '식비 예산' }) as HTMLInputElement).value).toBe('30,000')
  fireEvent.click(screen.getByRole('button', { name: '식비 미사용 예산 이월 켜기' }))
  fireEvent.click(screen.getByRole('button', { name: '저장하기' }))
  expect(onSave).toHaveBeenCalledWith([{ category: '식비', limit: 30000, carryover: true, yearMonth: '2026-11' }], 'thisMonth')
})
