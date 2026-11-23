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
 * 시작 잔액을 입력한 계좌의 잔액.
 * 잔액 = 시작 잔액 + 기준일 다음 날부터의 (수입 − 지출). 오늘 이후 날짜로 미리 적은 거래도 반영한다.
 * atDate를 주면 그날 끝 시점의 잔액이다. 기준일보다 앞이면 그 사이 거래를 거꾸로 되돌린다.
 */
export function getAccountBalances(methods: UserPaymentMethod[], transactions: Transaction[], atDate?: string): AccountBalance[] {
  const accounts = methods.filter((m) => isBalanceAccount(m) && typeof m.openingBalance === 'number')
  if (accounts.length === 0) return []
  const balances = new Map(accounts.map((m) => [m.id, m.openingBalance ?? 0]))
  const all = methods.filter(isBalanceAccount)
  for (const t of transactions) {
    const account = findAccount(t, all)
    if (!account || !balances.has(account.id)) continue
    const asOf = account.balanceAsOf ?? ''
    const delta = t.type === 'income' ? t.amount : -t.amount
    let sign = 0
    if (t.date > asOf && (atDate === undefined || t.date <= atDate)) sign = 1
    else if (atDate !== undefined && t.date > atDate && t.date <= asOf) sign = -1
    if (sign) balances.set(account.id, (balances.get(account.id) ?? 0) + sign * delta)
  }
  return accounts.map((method) => ({ method, balance: balances.get(method.id) ?? 0 }))
}

export interface NetWorthSummary {
  accountTotal: number
  loanTotal: number
  /** 계좌 잔액 합계 − 대출 남은 원금 합계 */
  netWorth: number
}

/** 잔액을 입력한 계좌가 있을 때만 의미가 있다 (수입−지출 누적에서 대출을 빼면 이중 차감이 된다) */
export function summarizeNetWorth(accounts: AccountBalance[], loanRemainings: number[]): NetWorthSummary {
  const accountTotal = accounts.reduce((s, a) => s + a.balance, 0)
  const loanTotal = loanRemainings.reduce((s, v) => s + v, 0)
  return { accountTotal, loanTotal, netWorth: accountTotal - loanTotal }
}
