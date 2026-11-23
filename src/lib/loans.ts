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
