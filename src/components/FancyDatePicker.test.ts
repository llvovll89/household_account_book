import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import FancyDatePicker from './FancyDatePicker'

vi.mock('./CalendarDatePicker', () => ({ default: ({ initiallyOpen, onChange }: { initiallyOpen: boolean; onChange: (v: string) => void }) => createElement('button', { onClick: () => onChange('2026-11-03') }, initiallyOpen ? '달력 열림' : '달력 닫힘') }))

it('renders a date trigger without mounting the calendar, then opens on request and forwards the selection', async () => {
  const onChange = vi.fn()
  render(createElement(FancyDatePicker, { value: '2026-11-02', onChange }))
  expect(screen.queryByRole('button', { name: '달력 열림' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '날짜 선택: 2026.11.02 (월)' }))
  fireEvent.click(await screen.findByRole('button', { name: '달력 열림' }))
  expect(onChange).toHaveBeenCalledWith('2026-11-03')
})
