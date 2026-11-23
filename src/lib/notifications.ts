import type { Budget, RecurringTransaction, Subscription, Transaction, UserPaymentMethod } from '../types'
import { getBudgetProgress } from './budgets'
import { fmt, parseYmdLocal, toLocalDateStr, toYearMonth } from './format'
import { getDaysUntilMonthDay, isRecurringPendingForMonth } from './recurringSchedule'
import { getDaysUntilNextBilling } from './subscriptions'

export type NotificationKind = 'subscription' | 'recurring' | 'card' | 'budget' | 'record-gap'

export interface AppNotification {
  /** 같은 알림을 하루 동안 닫아두기 위한 키 (날짜 포함) */
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** 높을수록 위에 */
  priority: number
}

export interface NotificationInput {
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  subscriptions: Subscription[]
  userPaymentMethods: UserPaymentMethod[]
  today: Date
}

const dayLabel = (days: number) => (days === 0 ? '오늘' : '내일')

/** 앱을 열었을 때 보여줄 알림 목록. 결제 예정(오늘·내일), 예산 80% 이상, 2일 이상 기록 공백 */
export function buildNotifications({ transactions, budgets, recurring, subscriptions, userPaymentMethods, today }: NotificationInput): AppNotification[] {
  const todayStr = toLocalDateStr(today)
  const ym = toYearMonth(today)
  const list: AppNotification[] = []

  // 자동 기록으로 정기 내역에 연결된 구독은 정기 지출 알림으로 한 번만 알린다
  const linkedRecurringIds = new Set(recurring.map((r) => r.id))
  for (const s of subscriptions) {
    if (s.recurringId && linkedRecurringIds.has(s.recurringId)) continue
    const days = getDaysUntilNextBilling(s, today)
    if (days > 1) continue
    list.push({ id: `subscription:${s.id}:${todayStr}`, kind: 'subscription', priority: 3 - days,
      title: `${s.name} 결제 ${dayLabel(days)}`, body: s.currency === 'USD' ? `$${s.amount}` : `${fmt(s.amount)}원` })
  }

  for (const r of recurring) {
    if (r.type !== 'expense' || r.frequency === 'weekly' || r.frequency === 'biweekly') continue
    if (!isRecurringPendingForMonth(r, ym)) continue
    const days = getDaysUntilMonthDay(r.dayOfMonth, today)
    if (days > 1) continue
    list.push({ id: `recurring:${r.id}:${todayStr}`, kind: 'recurring', priority: 3 - days,
      title: `${r.description || r.category} ${dayLabel(days)} 나가요`, body: `${fmt(r.amount)}원 정기 지출` })
  }

  for (const m of userPaymentMethods) {
    if (m.type !== 'credit' || !m.billingDay) continue
    const days = getDaysUntilMonthDay(m.billingDay, today)
    if (days > 1) continue
    list.push({ id: `card:${m.id}:${todayStr}`, kind: 'card', priority: 3 - days,
      title: `${m.label} 결제일 ${dayLabel(days)}`, body: '결제 계좌 잔액을 확인하세요' })
  }

  for (const b of getBudgetProgress(budgets, transactions, ym)) {
    if (b.effectiveLimit <= 0) continue
    const pct = Math.round((b.spent / b.effectiveLimit) * 100)
    if (pct < 80) continue
    // 80%·100% 단계마다 한 번씩 (같은 단계는 이번 달 동안 같은 id)
    const stage = pct >= 100 ? 100 : 80
    list.push({ id: `budget:${b.category}:${ym}:${stage}`, kind: 'budget', priority: pct >= 100 ? 2 : 1,
      title: pct >= 100 ? `${b.category} 예산을 넘었어요` : `${b.category} 예산 ${pct}% 사용`,
      body: `${fmt(b.spent)}원 / ${fmt(b.effectiveLimit)}원` })
  }

  if (transactions.length > 0) {
    const latest = transactions.reduce((max, t) => (t.date <= todayStr && t.date > max ? t.date : max), '')
    const gap = latest ? Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - parseYmdLocal(latest).getTime()) / 86_400_000) : 0
    if (latest && gap >= 2) {
      list.push({ id: `record-gap:${todayStr}`, kind: 'record-gap', priority: 0,
        title: `${gap}일째 기록이 없어요`, body: '빠뜨린 지출이 있는지 확인해 보세요' })
    }
  }

  return list.sort((a, b) => b.priority - a.priority)
}
