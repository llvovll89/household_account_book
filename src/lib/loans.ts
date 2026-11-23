import type { Loan, Transaction } from '../types'

export interface LoanStatus {
  loan: Loan
  /** 기준일 이후 갚은 원금 */
  repaid: number
  /** 지금 남은 원금 (0 미만이면 0) */
  remaining: number
}

/** 상환 거래의 원금. 원금·이자를 나눠 적었으면 원금만, 아니면 전액을 원금으로 본다 */
function principalOf(t: Transaction): number {
  return t.loanPrincipal ?? t.amount
}

/**
 * 대출별 남은 원금 = 기준일의 남은 원금 − 기준일 다음 날부터 연결된 지출 거래의 원금.
 * atDate를 주면 그날 끝 시점의 남은 원금이다 (기준일보다 앞이면 그 사이 상환을 되돌린다).
 */
export function getLoanStatuses(loans: Loan[], transactions: Transaction[], atDate?: string): LoanStatus[] {
  return loans.map((loan) => {
    let repaid = 0
    let undone = 0
    for (const t of transactions) {
      if (t.loanId !== loan.id || t.type !== 'expense') continue
      if (t.date > loan.balanceAsOf && (atDate === undefined || t.date <= atDate)) repaid += principalOf(t)
      else if (atDate !== undefined && t.date > atDate && t.date <= loan.balanceAsOf) undone += principalOf(t)
    }
    return { loan, repaid, remaining: Math.max(0, loan.balance - repaid + undone) }
  })
}

export interface PayoffProjection {
  /** 다 갚기까지 남은 개월 수 */
  months: number
  /** 완납 예상 월 (YYYY-MM) */
  payoffYM: string
  /** 앞으로 낼 이자 합계 (원 단위 반올림) */
  totalInterest: number
}

const MAX_MONTHS = 600

/**
 * 원리금 균등(매달 같은 금액) 기준 완납 예측. 매달 이자 = 남은 원금 × 연이율 / 12.
 * 월 상환액이 이자보다 작거나 같으면 끝나지 않으므로 null.
 */
export function projectPayoff(remaining: number, annualRatePct: number, monthlyPayment: number, fromYM: string): PayoffProjection | null {
  if (remaining <= 0) return { months: 0, payoffYM: fromYM, totalInterest: 0 }
  if (monthlyPayment <= 0) return null
  const monthlyRate = annualRatePct / 100 / 12
  if (remaining * monthlyRate >= monthlyPayment) return null
  let left = remaining
  let months = 0
  let totalInterest = 0
  while (left > 0 && months < MAX_MONTHS) {
    const interest = left * monthlyRate
    totalInterest += interest
    left = left + interest - monthlyPayment
    months += 1
  }
  if (left > 0) return null
  const [y, m] = fromYM.split('-').map(Number)
  const payoff = new Date(y, m - 1 + months, 1)
  return { months, payoffYM: `${payoff.getFullYear()}-${String(payoff.getMonth() + 1).padStart(2, '0')}`, totalInterest: Math.round(totalInterest) }
}

/** 최근 3개월(이번 달 제외) 연결된 상환 금액의 월평균. 기록이 없으면 null */
export function estimateMonthlyPayment(loanId: string, transactions: Transaction[], currentYM: string): number | null {
  const [y, m] = currentYM.split('-').map(Number)
  const months = [1, 2, 3].map((k) => {
    const d = new Date(y, m - 1 - k, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const total = transactions
    .filter((t) => t.loanId === loanId && t.type === 'expense' && months.includes(t.date.slice(0, 7)))
    .reduce((s, t) => s + t.amount, 0)
  return total > 0 ? Math.round(total / 3) : null
}
