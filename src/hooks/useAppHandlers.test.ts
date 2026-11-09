import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { SetStateAction } from 'react'
import { useAppHandlers } from './useAppHandlers'
import type { Transaction, RecurringTransaction, Budget, Subscription, SavingsGoal } from '../types'
vi.mock('../firebase/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('../lib/receiptStorage', () => ({ deleteReceiptImage: vi.fn() }))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))
vi.mock('../lib/storage', () => ({
  loadSettings: vi.fn(async () => ({})), loadTransactions: vi.fn(async () => []),
  saveTransactions: vi.fn(async () => {}), saveSettings: vi.fn(async () => {}),
  saveRecurring: vi.fn(async () => {}), saveBudgets: vi.fn(async () => {}),
  saveSubscriptions: vi.fn(async () => {}), saveGoals: vi.fn(async () => {}), saveMemos: vi.fn(async () => {}),
}))
import { saveSettings, saveRecurring, saveTransactions } from '../lib/storage'
import { showToast } from '../lib/toast'
import { beginUsageFlow, getUsageSummary } from '../lib/usageFlow'

it('announces feedback once after persistence succeeds, and never on a failed write', async () => {
  const tasks: (() => Promise<void>)[] = []
  const onRecordSaved = vi.fn()
  const { result } = renderHook(() => useAppHandlers({
    transactions: [], budgets: [{ category: '식비', limit: 10000 }], onRecordSaved, editingTransaction: null, yearMonth: '2026-10',
    customExpenseCategories: [], customIncomeCategories: [], transactionTemplates: [], autoCategoryRules: [],
    persist: task => { tasks.push(task) }, dispatchUI: vi.fn(),
    setTransactions: vi.fn(), setRecurring: vi.fn(), setBudgets: vi.fn(), setSubscriptions: vi.fn(), setGoals: vi.fn(), setMemos: vi.fn(),
    setCustomExpenseCategories: vi.fn(), setCustomIncomeCategories: vi.fn(), setUserPaymentMethods: vi.fn(),
    setTransactionTemplates: vi.fn(), setAutoCategoryRules: vi.fn(), setHiddenWidgets: vi.fn(),
  }))
  vi.mocked(showToast).mockClear()
  const item = { type: 'expense' as const, category: '식비', amount: 9000, description: '', date: '2026-10-12' }
  const flowId = beginUsageFlow('entry')
  act(() => result.current.handleSaveTransaction([item], flowId))
  expect(showToast).not.toHaveBeenCalled()
  expect(onRecordSaved).not.toHaveBeenCalled()
  expect(getUsageSummary().entry.completed).toBe(0)
  await tasks[0]()
  expect(showToast).toHaveBeenCalledOnce()
  expect(onRecordSaved).toHaveBeenCalledOnce()
  expect(getUsageSummary().entry.completed).toBe(1)
  expect(showToast).toHaveBeenLastCalledWith(expect.stringContaining('1,000원 남았어요'), 6000, 'success')
  vi.mocked(showToast).mockClear()
  onRecordSaved.mockClear()
  vi.mocked(saveTransactions).mockRejectedValueOnce(new Error('offline'))
  const failedId = beginUsageFlow('entry')
  act(() => result.current.handleSaveTransaction([item], failedId))
  await expect(tasks[1]()).rejects.toThrow('offline')
  expect(showToast).not.toHaveBeenCalled()
  expect(onRecordSaved).not.toHaveBeenCalled()
  expect(getUsageSummary().entry).toMatchObject({ completed: 1, withErrors: 1 })
})

it('moves linked records, preserves budget totals, and applies recurring transfers with the original account', async () => {
  const transactions: Transaction[] = [{ id: 'tx', type: 'expense', category: '보장', amount: 100, description: '', date: '2026-10-01', createdAt: 1 }]
  const recurring: RecurringTransaction[] = [{ id: 'r', type: 'expense', category: '보장', amount: 100, description: '', dayOfMonth: 1, lastAppliedMonth: '', createdAt: 1, paymentMethod: 'transfer', paymentMethodId: 'bank' }]
  const state = {
    transactions, recurring, budgets: [{ category: '보장', limit: 100 }, { category: '보험', limit: 200 }] as Budget[],
    subscriptions: [{ id: 's', category: '보장', amount: 100, name: '정기', currency: 'KRW', billingDay: 1, memo: '', createdAt: 1 }] as Subscription[],
    goals: [{ id: 'g', name: '준비', targetAmount: 1000, currentAmount: 0, emoji: '', color: '', memo: '', createdAt: 1, linkedCategory: '보장' }] as SavingsGoal[],
  }
  function setter<K extends keyof typeof state>(key: K) {
    return (value: SetStateAction<(typeof state)[K]>) => { state[key] = typeof value === 'function' ? value(state[key]) : value }
  }
  const { result, rerender } = renderHook(() => useAppHandlers({
    transactions: state.transactions, editingTransaction: null, yearMonth: '2026-10',
    customExpenseCategories: ['보장'], customIncomeCategories: [], transactionTemplates: [], autoCategoryRules: [],
    persist: task => { void task() }, dispatchUI: vi.fn(),
    setTransactions: setter('transactions'), setRecurring: setter('recurring'), setBudgets: setter('budgets'),
    setSubscriptions: setter('subscriptions'), setGoals: setter('goals'), setMemos: vi.fn(),
    setCustomExpenseCategories: vi.fn(), setCustomIncomeCategories: vi.fn(), setUserPaymentMethods: vi.fn(),
    setTransactionTemplates: vi.fn(), setAutoCategoryRules: vi.fn(), setHiddenWidgets: vi.fn(),
  }))
  act(() => result.current.handleSaveCategories([], [], { expense: { 보장: '보험' }, income: {} }))
  expect(state.transactions[0].category).toBe('보험')
  expect(state.recurring[0].category).toBe('보험')
  expect(state.budgets).toEqual([{ category: '보험', limit: 300, carryover: false }])
  expect(state.subscriptions[0].category).toBe('보험')
  expect(state.goals[0].linkedCategory).toBe('보험')
  await waitFor(() => expect(saveSettings).toHaveBeenCalled())
  rerender()
  await act(async () => { await result.current.handleApplyRecurring(state.recurring) })
  expect(state.transactions.at(-1)).toMatchObject({ paymentMethod: 'transfer', paymentMethodId: 'bank', category: '보험' })
  expect(state.transactions[0].category).toBe('보험')
  expect(saveRecurring).toHaveBeenCalled()
})

it('removes only exported IDs from the latest application state and persistence snapshot', async () => {
  const records: Transaction[] = [
    ['september', '2026-09-10'], ['october', '2026-10-15'], ['same-day', '2026-10-15'], ['november', '2026-11-01'],
  ].map(([id, date]) => ({ id, date, type: 'expense', amount: 1000, category: '식비', description: '', createdAt: 1 }))
  let state = records
  const tasks: (() => Promise<void>)[] = []
  const { result } = renderHook(() => useAppHandlers({
    transactions: records, editingTransaction: null, yearMonth: '2026-10',
    customExpenseCategories: [], customIncomeCategories: [], transactionTemplates: [], autoCategoryRules: [],
    persist: task => { tasks.push(task) }, dispatchUI: vi.fn(),
    setTransactions: value => { state = typeof value === 'function' ? value(state) : value },
    setRecurring: vi.fn(), setBudgets: vi.fn(), setSubscriptions: vi.fn(), setGoals: vi.fn(), setMemos: vi.fn(),
    setCustomExpenseCategories: vi.fn(), setCustomIncomeCategories: vi.fn(), setUserPaymentMethods: vi.fn(),
    setTransactionTemplates: vi.fn(), setAutoCategoryRules: vi.fn(), setHiddenWidgets: vi.fn(),
  }))
  const added = { ...records[1], id: 'added-after-preview' }
  state = [...state, added]
  act(() => result.current.handleTransactionArchive(['october']))
  const expected = [...records.filter(t => t.id !== 'october'), added]
  expect(state).toEqual(expected)
  await tasks[0]()
  expect(saveTransactions).toHaveBeenLastCalledWith(expected)
})

function renderRecurringHandlers(recurring: RecurringTransaction[], yearMonth: string) {
  const state = { transactions: [] as Transaction[], recurring }
  const { result } = renderHook(() => useAppHandlers({
    transactions: state.transactions, editingTransaction: null, yearMonth,
    customExpenseCategories: [], customIncomeCategories: [], transactionTemplates: [], autoCategoryRules: [],
    persist: task => { void task() }, dispatchUI: vi.fn(),
    setTransactions: value => { state.transactions = typeof value === 'function' ? value(state.transactions) : value },
    setRecurring: value => { state.recurring = typeof value === 'function' ? value(state.recurring) : value },
    setBudgets: vi.fn(), setSubscriptions: vi.fn(), setGoals: vi.fn(), setMemos: vi.fn(),
    setCustomExpenseCategories: vi.fn(), setCustomIncomeCategories: vi.fn(), setUserPaymentMethods: vi.fn(),
    setTransactionTemplates: vi.fn(), setAutoCategoryRules: vi.fn(), setHiddenWidgets: vi.fn(),
  }))
  return { result, state }
}

it('applying a monthly item from a past month never moves lastAppliedMonth backwards', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 9))
  const rent: RecurringTransaction = { id: 'rent', type: 'expense', category: '주거비', amount: 500000, description: '월세', dayOfMonth: 1, lastAppliedMonth: '2026-11', createdAt: 1 }
  const { result, state } = renderRecurringHandlers([rent], '2026-10')
  await act(async () => { await result.current.handleApplyRecurring([rent]) })
  expect(state.transactions.map(t => t.date)).toEqual(['2026-10-01'])
  expect(state.recurring[0].lastAppliedMonth).toBe('2026-11')
  vi.useRealTimers()
})

it('applying a weekly item records every missed occurrence on its real date', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 20))
  const lesson: RecurringTransaction = { id: 'w', type: 'expense', category: '교육', amount: 30000, description: '레슨', dayOfMonth: 1, frequency: 'weekly', weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-08-01', createdAt: 1 }
  const { result, state } = renderRecurringHandlers([lesson], '2026-08')
  await act(async () => { await result.current.handleApplyRecurring([lesson], '2026-08') })
  expect(state.transactions.map(t => t.date)).toEqual(['2026-08-08', '2026-08-15'])
  expect(state.recurring[0].lastAppliedDate).toBe('2026-08-15')
  vi.useRealTimers()
})
