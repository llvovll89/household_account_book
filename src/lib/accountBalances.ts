import type { Transaction, UserPaymentMethod } from '../types'

export interface AccountBalance {
  method: UserPaymentMethod
  balance: number
}

/** 잔액을 추적할 수 있는 결제수단인지 (신용카드는 청구액으로 따로 본다) */
export function isBalanceAccount(m: UserPaymentMethod): boolean {
  return m.type !== 'credit'
}

/**
 * 거래가 어느 계좌에서 나갔는지 찾는다.
 * paymentMethodId가 있으면 그 계좌, 없으면 같은 종류의 첫 계좌(예전 기록은 종류만 저장됨).
 */
function findAccount(t: Transaction, accounts: UserPaymentMethod[]): UserPaymentMethod | undefined {
  if (t.paymentMethodId) {
    const found = accounts.find((m) => m.id === t.paymentMethodId)
    if (found) return found
  }
  const type = t.paymentMethod ?? 'cash'
  return accounts.find((m) => m.type === type)
}

/**
 * 시작 잔액을 입력한 계좌의 현재 잔액.
 * 잔액 = 시작 잔액 + 기준일 다음 날부터의 (수입 − 지출). 오늘 이후 날짜로 미리 적은 거래도 반영한다.
 */
export function getAccountBalances(methods: UserPaymentMethod[], transactions: Transaction[]): AccountBalance[] {
  const accounts = methods.filter((m) => isBalanceAccount(m) && typeof m.openingBalance === 'number')
  if (accounts.length === 0) return []
  const balances = new Map(accounts.map((m) => [m.id, m.openingBalance ?? 0]))
  const all = methods.filter(isBalanceAccount)
  for (const t of transactions) {
    const account = findAccount(t, all)
    if (!account || !balances.has(account.id)) continue
    if (account.balanceAsOf && t.date <= account.balanceAsOf) continue
    balances.set(account.id, (balances.get(account.id) ?? 0) + (t.type === 'income' ? t.amount : -t.amount))
  }
  return accounts.map((method) => ({ method, balance: balances.get(method.id) ?? 0 }))
}
