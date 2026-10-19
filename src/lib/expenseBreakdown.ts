import type { Transaction } from '../types'

export type ExpenseView = 'all' | 'consumption' | 'savings' | 'loan'
export const EXPENSE_VIEW_LABELS: Record<ExpenseView, string> = {
  all: '전체 유출', consumption: '소비', savings: '저축', loan: '대출 상환',
}

export function getExpenseGroup(transaction: Pick<Transaction, 'category'>): Exclude<ExpenseView, 'all'> {
  if (transaction.category === '저축') return 'savings'
  if (transaction.category === '대출') return 'loan'
  return 'consumption'
}

export function summarizeExpenses(transactions: Transaction[]) {
  const result = { all: 0, consumption: 0, savings: 0, loan: 0, principal: 0, interest: 0, unsplit: 0 }
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    result.all += t.amount
    const group = getExpenseGroup(t)
    result[group] += t.amount
    if (group === 'loan') {
      if (typeof t.loanPrincipal === 'number' && typeof t.loanInterest === 'number' && t.loanPrincipal + t.loanInterest === t.amount) {
        result.principal += t.loanPrincipal
        result.interest += t.loanInterest
      } else result.unsplit += t.amount
    }
  }
  return result
}
