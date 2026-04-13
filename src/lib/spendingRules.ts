import type { Transaction, Budget } from '../types'

export type PresetKey = 'this_month' | 'last_month' | 'last_30' | 'last_90'

export interface Suggestion {
  id: string
  priority: 'high' | 'medium' | 'low'
  icon: string
  title: string
  body: string
  savingHint?: string
}

// ── Date helpers ────────────────────────────────────────────────

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateMinusDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T00:00:00')
  d.setDate(d.getDate() - days)
  return toYmd(d)
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
}

export function getPresetRange(preset: PresetKey): { start: string; end: string } {
  const today = new Date()
  const todayYmd = toYmd(today)

  if (preset === 'this_month') {
    return { start: `${todayYmd.slice(0, 7)}-01`, end: todayYmd }
  }

  if (preset === 'last_month') {
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastOfPrev = new Date(firstOfThisMonth.getTime() - 86_400_000)
    const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1)
    return { start: toYmd(firstOfPrev), end: toYmd(lastOfPrev) }
  }

  if (preset === 'last_30') {
    return { start: dateMinusDays(todayYmd, 29), end: todayYmd }
  }

  // last_90
  return { start: dateMinusDays(todayYmd, 89), end: todayYmd }
}

export function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const days = daysBetween(start, end)
  const prevEnd = dateMinusDays(start, 1)
  const prevStart = dateMinusDays(prevEnd, days - 1)
  return { prevStart, prevEnd }
}

export function filterByRange(txs: Transaction[], start: string, end: string): Transaction[] {
  return txs.filter((t) => t.date >= start && t.date <= end)
}

// ── Rule engine ─────────────────────────────────────────────────

export function generateSuggestions(
  periodTxs: Transaction[],
  prevTxs: Transaction[],
  allTxs: Transaction[],
  budgets: Budget[],
  start: string,
  end: string,
): Suggestion[] {
  const suggestions: Suggestion[] = []

  const periodExpenses = periodTxs.filter((t) => t.type === 'expense')
  const periodIncome   = periodTxs.filter((t) => t.type === 'income')
  const prevExpenses   = prevTxs.filter((t) => t.type === 'expense')

  const totalExpense = periodExpenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome  = periodIncome.reduce((s, t) => s + t.amount, 0)
  const days = daysBetween(start, end)

  const catMap: Record<string, number> = {}
  periodExpenses.forEach((t) => { catMap[t.category] = (catMap[t.category] || 0) + t.amount })

  const prevCatMap: Record<string, number> = {}
  prevExpenses.forEach((t) => { prevCatMap[t.category] = (prevCatMap[t.category] || 0) + t.amount })

  // Rule 1: 카테고리 급등
  const spikes = Object.entries(catMap)
    .filter(([cat, amt]) => {
      const prev = prevCatMap[cat] || 0
      if (prev === 0) return false
      return ((amt - prev) / prev) * 100 > 30 && (amt - prev) > 20_000
    })
    .sort((a, b) => b[1] - a[1])

  if (spikes.length > 0) {
    const [cat, amt] = spikes[0]
    const prev = prevCatMap[cat]!
    const pct  = Math.round(((amt - prev) / prev) * 100)
    const diff = amt - prev
    suggestions.push({
      id: 'spike',
      priority: 'high',
      icon: '📈',
      title: `${cat} 지출이 전 기간 대비 ${pct}% 늘었어요`,
      body: `이전 기간 ${prev.toLocaleString('ko-KR')}원 → 이번 기간 ${amt.toLocaleString('ko-KR')}원으로 ${diff.toLocaleString('ko-KR')}원 증가했어요.`,
      savingHint: `${Math.round(diff / 2).toLocaleString('ko-KR')}원 이상 절감 여지가 있어요`,
    })
  }

  // Rule 6: 예산 초과
  if (budgets.length > 0) {
    const over = budgets
      .filter((b) => {
        const spent = catMap[b.category] || 0
        const prorated = days < 30 ? (b.limit / 30) * days : b.limit
        return spent > prorated && spent > 0
      })
      .sort((a, b) => {
        const oa = (catMap[a.category] || 0) - a.limit
        const ob = (catMap[b.category] || 0) - b.limit
        return ob - oa
      })

    if (over.length > 0) {
      const b     = over[0]
      const spent = catMap[b.category] || 0
      const pct   = Math.round((spent / b.limit) * 100)
      suggestions.push({
        id: 'over_budget',
        priority: 'high',
        icon: '🚨',
        title: `${b.category} 예산을 ${pct - 100}% 초과했어요`,
        body: `예산 ${b.limit.toLocaleString('ko-KR')}원에 ${spent.toLocaleString('ko-KR')}원을 지출했어요. ${b.category} 지출을 조절해보세요.`,
        savingHint: `${(spent - b.limit).toLocaleString('ko-KR')}원 초과`,
      })
    }
  }

  // Rule 3: 저축률 경고
  if (totalIncome > 0 && totalExpense / totalIncome > 0.85) {
    const pct = Math.round((totalExpense / totalIncome) * 100)
    suggestions.push({
      id: 'savings_rate',
      priority: 'high',
      icon: '⚠️',
      title: `소득의 ${pct}%를 지출했어요`,
      body: `이 기간 수입 ${totalIncome.toLocaleString('ko-KR')}원 중 ${totalExpense.toLocaleString('ko-KR')}원을 지출했어요. 저축률이 ${100 - pct}%에 불과해요.`,
      savingHint: `저축률 10% 달성을 위해 ${Math.round(totalIncome * 0.1).toLocaleString('ko-KR')}원 이상 저축 권장`,
    })
  }

  // Rule 2: 단일 항목 쏠림
  if (totalExpense > 0) {
    const dominant = Object.entries(catMap).find(([, amt]) => amt / totalExpense > 0.4)
    if (dominant) {
      const [cat, amt] = dominant
      const pct = Math.round((amt / totalExpense) * 100)
      suggestions.push({
        id: 'dominant',
        priority: 'medium',
        icon: '🎯',
        title: `${cat}이(가) 전체 지출의 ${pct}%를 차지해요`,
        body: `${cat}에 ${amt.toLocaleString('ko-KR')}원을 썼어요. 한 항목에 지출이 집중되어 있어요.`,
        savingHint: `30% 줄이면 ${Math.round(amt * 0.3).toLocaleString('ko-KR')}원 절약 가능`,
      })
    }
  }

  // Rule 4: 주말 지출 집중
  if (periodExpenses.length >= 5) {
    const weekendByDate: Record<string, number> = {}
    const weekdayByDate: Record<string, number> = {}

    periodExpenses.forEach((t) => {
      const dow = new Date(t.date + 'T00:00:00').getDay()
      if (dow === 0 || dow === 6) {
        weekendByDate[t.date] = (weekendByDate[t.date] || 0) + t.amount
      } else {
        weekdayByDate[t.date] = (weekdayByDate[t.date] || 0) + t.amount
      }
    })

    const weekendDates  = Object.keys(weekendByDate)
    const weekdayDates  = Object.keys(weekdayByDate)
    const weekendTotal  = Object.values(weekendByDate).reduce((s, v) => s + v, 0)
    const weekdayTotal  = Object.values(weekdayByDate).reduce((s, v) => s + v, 0)
    const weekendAvg    = weekendTotal / (weekendDates.length || 1)
    const weekdayAvg    = weekdayTotal / (weekdayDates.length || 1)

    if (weekendAvg > weekdayAvg * 2 && weekendTotal > 50_000) {
      const ratio = (weekendAvg / weekdayAvg).toFixed(1)
      suggestions.push({
        id: 'weekend',
        priority: 'medium',
        icon: '🎢',
        title: `주말 하루 지출이 평일의 ${ratio}배예요`,
        body: `주말 하루 평균 ${Math.round(weekendAvg).toLocaleString('ko-KR')}원, 평일 하루 평균 ${Math.round(weekdayAvg).toLocaleString('ko-KR')}원이에요. 주말 지출 계획을 세워보세요.`,
        savingHint: `주말 지출을 평일 수준으로 낮추면 월 ${Math.round((weekendAvg - weekdayAvg) * 8).toLocaleString('ko-KR')}원 절약 가능`,
      })
    }
  }

  // Rule 7: 일평균 지출 과다
  if (totalExpense > 0 && totalExpense / days > 100_000) {
    const dailyAvg = Math.round(totalExpense / days)
    suggestions.push({
      id: 'daily_avg',
      priority: 'medium',
      icon: '💸',
      title: `하루 평균 지출이 ${dailyAvg.toLocaleString('ko-KR')}원이에요`,
      body: `${days}일 동안 총 ${totalExpense.toLocaleString('ko-KR')}원을 지출했어요. 하루 10만원 이하를 목표로 삼아보세요.`,
      savingHint: `목표 달성 시 ${Math.round((dailyAvg - 100_000) * days).toLocaleString('ko-KR')}원 절약 가능`,
    })
  }

  // Rule 10: 수입 미기록
  if (periodIncome.length === 0 && periodExpenses.length > 0) {
    suggestions.push({
      id: 'no_income',
      priority: 'medium',
      icon: '📝',
      title: '이 기간에 수입 내역이 없어요',
      body: '수입을 기록하면 저축률, 지출 비율 분석이 가능해요. 급여나 용돈을 추가해보세요.',
    })
  }

  // Rule 5: 정기구독 감지
  const SUBSCRIPTION_KEYWORDS = [
    '구독', '이용료', '월정액', '넷플', '유튜브', '스포티', '애플', '왓챠', '웨이브', '쿠팡', '멜론', '지니',
  ]
  const kwSubs = periodExpenses.filter((t) =>
    SUBSCRIPTION_KEYWORDS.some((kw) => t.description.includes(kw)),
  )

  if (kwSubs.length > 0) {
    const subTotal = kwSubs.reduce((s, t) => s + t.amount, 0)
    const names = [...new Set(kwSubs.map((t) => t.description))].slice(0, 4).join(', ')
    suggestions.push({
      id: 'subscriptions',
      priority: 'low',
      icon: '🔄',
      title: `구독 서비스 지출이 ${subTotal.toLocaleString('ko-KR')}원이에요`,
      body: `감지된 구독 항목: ${names} 등. 실제로 모두 사용 중인지 확인해보세요.`,
      savingHint: `월 환산 ${Math.round(subTotal / days * 30).toLocaleString('ko-KR')}원`,
    })
  } else {
    // 반복 거래 패턴 감지 (2개월 이상 동일 설명+금액)
    const descAmtMonths: Record<string, Set<string>> = {}
    allTxs.filter((t) => t.type === 'expense').forEach((t) => {
      const key = `${t.description}|${t.amount}`
      if (!descAmtMonths[key]) descAmtMonths[key] = new Set()
      descAmtMonths[key].add(t.date.slice(0, 7))
    })

    const recurring = Object.entries(descAmtMonths)
      .filter(([, months]) => months.size >= 2)
      .map(([key, months]) => {
        const [desc, amtStr] = key.split('|')
        return { desc, amount: parseInt(amtStr, 10), months: months.size }
      })
      .sort((a, b) => b.amount - a.amount)

    if (recurring.length > 0) {
      const total = recurring.reduce((s, r) => s + r.amount, 0)
      const names = recurring.slice(0, 3).map((r) => `${r.desc}(${r.amount.toLocaleString('ko-KR')}원)`).join(', ')
      suggestions.push({
        id: 'recurring_sub',
        priority: 'low',
        icon: '🔄',
        title: `반복 지출 ${recurring.length}건이 감지됐어요`,
        body: `월 ${total.toLocaleString('ko-KR')}원 규모: ${names} 등. 실제로 모두 필요한지 확인해보세요.`,
        savingHint: '불필요한 항목 해지 시 절약 가능',
      })
    }
  }

  // Rule 8: 소액 다건 누수
  const smallTxs = periodExpenses.filter((t) => t.amount < 5_000)
  if (smallTxs.length > 15) {
    const smallTotal = smallTxs.reduce((s, t) => s + t.amount, 0)
    if (smallTotal > 30_000) {
      suggestions.push({
        id: 'small_txs',
        priority: 'low',
        icon: '☕',
        title: `소액 지출 ${smallTxs.length}건, 합계 ${smallTotal.toLocaleString('ko-KR')}원이에요`,
        body: '5천원 미만 소액 결제가 모이면 무시 못 할 금액이 돼요. 커피, 편의점 지출을 확인해보세요.',
        savingHint: `월 환산 ${Math.round(smallTotal / days * 30).toLocaleString('ko-KR')}원`,
      })
    }
  }

  // Rule 9: 태그 집중
  if (totalExpense > 0) {
    const tagMap: Record<string, number> = {}
    periodExpenses.forEach((t) => {
      ;(t.tags ?? []).forEach((tag) => {
        tagMap[tag] = (tagMap[tag] || 0) + t.amount
      })
    })
    const topTag = Object.entries(tagMap).sort((a, b) => b[1] - a[1])[0]
    if (topTag && topTag[1] / totalExpense > 0.25) {
      const [tag, amt] = topTag
      const pct = Math.round((amt / totalExpense) * 100)
      suggestions.push({
        id: 'tag_concentration',
        priority: 'low',
        icon: '🏷️',
        title: `'${tag}' 태그 지출이 전체의 ${pct}%예요`,
        body: `'${tag}' 관련 지출이 ${amt.toLocaleString('ko-KR')}원이에요. 월 환산 ${Math.round(amt / days * 30).toLocaleString('ko-KR')}원 수준이에요.`,
      })
    }
  }

  // 우선순위 순 정렬
  const order = { high: 0, medium: 1, low: 2 }
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority])
}
