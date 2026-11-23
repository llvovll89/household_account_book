import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecurringTransaction } from '../types'
import { CATEGORY_EMOJI } from '../types'
import { toYearMonth } from '../lib/format'
import { isRecurringDueToday } from '../lib/recurringSchedule'
import { showToast } from '../lib/toast'

export type AutoApplyRecurringMode = 'ask' | 'always' | 'never'

const AUTO_APPLY_RECURRING_MODE_KEY = 'hb_recurring_auto_apply_mode'

export function formatRecurringToastSummary(items: RecurringTransaction[], limit = 3) {
  const preview = items
    .slice(0, limit)
    .map((item) => {
      const sign = item.type === 'income' ? '+' : '-'
      const emoji = CATEGORY_EMOJI[item.category] ?? '📦'
      return `${emoji}${item.category} ${sign}${item.amount.toLocaleString()}원`
    })
    .join(', ')
  const restCount = items.length - Math.min(items.length, limit)
  return restCount > 0 ? `${preview} 외 ${restCount}건` : preview
}

function parseAutoApplyRecurringMode(): AutoApplyRecurringMode {
  try {
    const raw = localStorage.getItem(AUTO_APPLY_RECURRING_MODE_KEY)
    if (raw === 'always' || raw === 'never' || raw === 'ask') return raw
  } catch {
    // 저장소를 못 읽으면 기본값
  }
  return 'ask'
}

interface Params {
  authReady: boolean
  isSyncing: boolean
  recurring: RecurringTransaction[]
  handleApplyRecurring: (pending: RecurringTransaction[], targetYM?: string) => Promise<boolean>
}

/**
 * 앱을 열었을 때 오늘 도래한 정기 항목을 한 번 찾아, 설정(묻기·항상·안 함)에 따라 등록하거나 확인 모달을 띄운다.
 * App.tsx에서 옮겨 왔다.
 */
export function useRecurringAutoApply({ authReady, isSyncing, recurring, handleApplyRecurring }: Params) {
  const [autoApplyPending, setAutoApplyPending] = useState<RecurringTransaction[]>([])
  const [showAutoApplyModal, setShowAutoApplyModal] = useState(false)
  const [autoApplyResultItems, setAutoApplyResultItems] = useState<RecurringTransaction[]>([])
  const [showAutoApplyResultModal, setShowAutoApplyResultModal] = useState(false)
  const [autoApplyMode, setAutoApplyMode] = useState<AutoApplyRecurringMode>(parseAutoApplyRecurringMode)
  const autoApplyCheckedRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_APPLY_RECURRING_MODE_KEY, autoApplyMode)
    } catch {
      // 저장 실패 시 이번 세션에서만 유지
    }
  }, [autoApplyMode])

  // 앱 로드 시 오늘 날짜 기준 정기 항목 자동 감지
  useEffect(() => {
    if (!authReady || isSyncing || autoApplyCheckedRef.current) return
    if (recurring.length === 0) return
    autoApplyCheckedRef.current = true

    const today = new Date()
    const todayYM = toYearMonth(today)
    const pending = recurring.filter((r) => isRecurringDueToday(r, today, todayYM))
    if (pending.length === 0) return

    if (autoApplyMode === 'always') {
      const appliedItems = [...pending]
      // 실패 안내는 persist가 띄우므로 성공했을 때만 결과를 알린다
      void handleApplyRecurring(pending, todayYM).then((saved) => {
        if (!saved) return
        showToast(`정기 항목 ${pending.length}건 자동 등록: ${formatRecurringToastSummary(pending)}`)
        setAutoApplyResultItems(appliedItems)
        setShowAutoApplyResultModal(true)
      })
      return
    }
    if (autoApplyMode === 'never') return

    // 세션당 한 번(autoApplyCheckedRef)만 도는 감지라 연쇄 렌더가 생기지 않는다.
    // App.tsx 안에 있을 때는 컴포넌트가 커서 이 규칙이 분석을 건너뛰었다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoApplyPending(pending)
    setShowAutoApplyModal(true)
  }, [authReady, isSyncing, recurring, autoApplyMode, handleApplyRecurring])

  const confirmAutoApply = useCallback(async () => {
    const todayYM = toYearMonth(new Date())
    setShowAutoApplyModal(false)
    const saved = await handleApplyRecurring(autoApplyPending, todayYM)
    if (!saved) return
    showToast(`정기 항목 ${autoApplyPending.length}건 등록: ${formatRecurringToastSummary(autoApplyPending)}`)
  }, [autoApplyPending, handleApplyRecurring])

  const dismissAutoApply = useCallback(() => setShowAutoApplyModal(false), [])

  const closeAutoApplyResult = useCallback(() => {
    setShowAutoApplyResultModal(false)
    setAutoApplyResultItems([])
  }, [])

  /** 백업 복원 직후처럼, 이번 실행에서 자동 적용을 다시 하지 않게 막는다 */
  const suppressAutoApply = useCallback(() => {
    autoApplyCheckedRef.current = true
    setAutoApplyPending([])
    setShowAutoApplyModal(false)
  }, [])

  return {
    autoApplyPending,
    showAutoApplyModal,
    autoApplyResultItems,
    showAutoApplyResultModal,
    autoApplyMode,
    setAutoApplyMode,
    confirmAutoApply,
    dismissAutoApply,
    closeAutoApplyResult,
    suppressAutoApply,
  }
}
