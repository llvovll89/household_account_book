import type { Transaction } from '../types'
import { getWeeklyReview } from '../lib/weeklyReview'
import { fmt } from '../lib/format'

export default function WeeklyReview({ transactions }: { transactions: Transaction[] }) {
  const review = getWeeklyReview(transactions)
  const difference = review.expense - review.previousExpense
  const shortDate = (date: string) => date.slice(5).replace('-', '.')
  return (
    <details className="home-weekly-review">
      <summary>이번 주 기록 돌아보기 <span>{review.recordedDays}일 기록 · 지출 {fmt(review.expense)}원</span></summary>
      <div>
        <p className="home-description">월요일부터 오늘까지 · {shortDate(review.start)}–{shortDate(review.end)}</p>
        <p className="weekly-review-total num">{fmt(review.expense)}<span>원</span></p>
        <p>{review.count === 0 ? '이번 주에는 아직 기록한 내역이 없어요.' : `${review.recordedDays}일 동안 ${review.count}건을 기록했어요.`}</p>
        {review.canCompare ? <p>지난주 같은 요일까지({shortDate(review.previousStart)}–{shortDate(review.previousEnd)}) 기록한 지출{difference === 0 ? '과 금액이 같아요.' : `보다 ${fmt(Math.abs(difference))}원 ${difference > 0 ? '많아요' : '적어요'}.`}</p>
          : <p>비교할 기록이 충분하지 않아요. 기록이 쌓이면 지난주 같은 기간과 비교해드려요.</p>}
        {review.topCategory && <p>가장 많이 기록한 지출은 {review.topCategory.category} {fmt(review.topCategory.amount)}원이에요.</p>}
        <p className="home-description">기록한 내역만 집계해요. 기록하지 않은 날은 무지출로 계산하지 않아요.</p>
      </div>
    </details>
  )
}
