import { useMemo, useState } from 'react'
import { Bell, CalendarClock, CreditCard, PencilLine, PiggyBank, Repeat, X } from 'lucide-react'
import { buildNotifications, type NotificationInput, type NotificationKind } from '../lib/notifications'
import { InlineDialog } from './ui/InlineDialog'

const DISMISSED_KEY = 'hb_dismissed_notifications'

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  subscription: CalendarClock,
  recurring: Repeat,
  card: CreditCard,
  budget: PiggyBank,
  'record-gap': PencilLine,
}

// 닫은 알림 id는 이 기기에만 기억한다 (id에 날짜·단계가 들어 있어 다음 날·다음 단계에 다시 뜬다)
function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-200)))
  } catch {
    // 저장소를 쓸 수 없으면 이번 세션에서만 닫힌다
  }
}

type Props = Omit<NotificationInput, 'today'>

export function NotificationCenter(props: Props) {
  const { transactions, budgets, recurring, subscriptions, userPaymentMethods } = props
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(readDismissed)
  const notifications = useMemo(
    () => buildNotifications({ transactions, budgets, recurring, subscriptions, userPaymentMethods, today: new Date() })
      .filter((n) => !dismissed.includes(n.id)),
    [transactions, budgets, recurring, subscriptions, userPaymentMethods, dismissed],
  )

  function dismiss(ids: string[]) {
    const next = [...dismissed, ...ids]
    setDismissed(next)
    writeDismissed(next)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={notifications.length > 0 ? `알림 ${notifications.length}개` : '알림'}
        className="relative w-8 h-8 rounded-xl bg-raised hover:bg-tone-hover transition-colors border border-line flex items-center justify-center"
      >
        <Bell size={14} className="text-muted" />
        {notifications.length > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-expense text-[9px] font-bold text-white flex items-center justify-center num">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>
      {open && (
        <InlineDialog
          onClose={() => setOpen(false)}
          label="알림"
          containerClassName="fixed inset-0 z-50 bg-black/60 flex items-end justify-center modal-backdrop"
          panelClassName="bg-surface w-full max-w-lg rounded-t-[28px] p-5 max-h-[80vh] overflow-y-auto modal-panel"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-base font-bold text-fg">알림</p>
            <div className="flex items-center gap-2">
              {notifications.length > 1 && (
                <button type="button" onClick={() => dismiss(notifications.map((n) => n.id))} className="text-[12px] font-semibold text-accent px-2 py-1">
                  모두 확인
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="알림 닫기" className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-muted">
                <X size={16} />
              </button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">새 알림이 없어요</p>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind]
                return (
                  <li key={n.id} className="flex items-center gap-3 bg-raised rounded-2xl px-4 py-3">
                    <Icon size={16} className={n.kind === 'budget' ? 'text-warning' : 'text-accent'} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-fg">{n.title}</p>
                      <p className="text-[11px] text-muted num">{n.body}</p>
                    </div>
                    <button type="button" onClick={() => dismiss([n.id])} aria-label={`${n.title} 알림 확인`} className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-fg">
                      <X size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </InlineDialog>
      )}
    </>
  )
}
