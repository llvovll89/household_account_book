import { useEffect, useMemo, useState, useRef } from 'react'
import { Pencil, Trash2, Search, X, CalendarDays, List as ListIcon, FileDown, Hash, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react'
import type { Transaction, UserPaymentMethod } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR, PAYMENT_METHOD_LABEL } from '../types'
import CalendarView from './CalendarView'
import ExportModal from './ExportModal'
import FancyDatePicker from './FancyDatePicker'
import TransactionDetailModal from './TransactionDetailModal'
import { fmt } from '../lib/format'
import { loadSettings, saveSettings } from '../lib/storage'
import { getBillingStage, getStatementYMForCardExpense, isCreditPaymentMethod, resolveCardBillingDay, resolvePaymentMethod } from '../lib/cardBilling'
import { showToast } from '../lib/toast'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  userPaymentMethods?: UserPaymentMethod[]
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
  onBulkDelete?: (ids: string[]) => void
  onArchiveDone?: (cutoff: string) => void
}

type ViewMode = 'list' | 'calendar'

type FilterType = 'all' | 'income' | 'expense'
type MethodFilterType = 'all' | 'cash' | 'check' | 'credit' | string
type BillingFilterType = 'all' | 'current' | 'next' | 'later'
type PeriodMode = 'day' | 'week' | 'month'
type QuickFilterPreset = 'all' | 'cash-expense' | 'check-expense' | 'credit-current' | 'credit-next'

const FILTER_TYPE_KEY = 'hb_tx_type_filter'
const METHOD_FILTER_KEY = 'hb_tx_method_filter'
const BILLING_FILTER_KEY = 'hb_tx_billing_filter'
const STATEMENT_MONTH_FILTER_KEY = 'hb_tx_statement_month_filter'
const FILTER_PANEL_OPEN_KEY = 'hb_tx_filter_panel_open'
const BALANCE_SECTION_OPEN_KEY = 'hb_tx_balance_section_open'
const ACTIVE_FILTERS_SECTION_OPEN_KEY = 'hb_tx_active_filters_section_open'
const INSIGHTS_SECTION_OPEN_KEY = 'hb_tx_insights_section_open'
const GROUP_PAGE_SIZE = 12
const ITEM_PAGE_SIZE = 20

function getInitialSectionOpen(storageKey: string) {
  const saved = localStorage.getItem(storageKey)
  if (saved === 'true') return true
  if (saved === 'false') return false
  if (typeof window === 'undefined') return true
  return window.innerWidth > 640
}

function HighlightText({ text, query, className }: { text: string; query: string; className?: string }) {
  if (!query.trim()) return <span className={className}>{text}</span>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-[#F5BE3A]/30 text-[#F5BE3A] rounded-sm not-italic">{p}</mark>
          : p
      )}
    </span>
  )
}

export default function TransactionList({ transactions, yearMonth, userPaymentMethods = [], onEdit, onDelete, onBulkDelete, onArchiveDone }: Props) {
  const [filter, setFilter] = useState<FilterType>(() => {
    const saved = localStorage.getItem(FILTER_TYPE_KEY)
    if (saved === 'income' || saved === 'expense' || saved === 'all') return saved
    return 'all'
  })
  const [methodFilter, setMethodFilter] = useState<MethodFilterType>(() => {
    const saved = localStorage.getItem(METHOD_FILTER_KEY)
    if (saved === 'card') return 'credit'
    if (saved === 'cash' || saved === 'check' || saved === 'credit' || saved === 'all') return saved
    return 'all'
  })
  const [billingFilter, setBillingFilter] = useState<BillingFilterType>(() => {
    const saved = localStorage.getItem(BILLING_FILTER_KEY)
    if (saved === 'current' || saved === 'next' || saved === 'later' || saved === 'all') return saved
    return 'all'
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showExport, setShowExport] = useState(false)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [baseDate, setBaseDate] = useState(`${yearMonth}-01`)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showTagSummary, setShowTagSummary] = useState(false)
  const [receiptModal, setReceiptModal] = useState({ open: false, url: '' })
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const touchStartX = useRef(0)
  const [cardBillingDay, setCardBillingDay] = useState(25)
  const [editingBillingDay, setEditingBillingDay] = useState(false)
  const [billingDayInput, setBillingDayInput] = useState('25')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(() => getInitialSectionOpen(FILTER_PANEL_OPEN_KEY))
  const [isBalanceSectionOpen, setIsBalanceSectionOpen] = useState(() => getInitialSectionOpen(BALANCE_SECTION_OPEN_KEY))
  const [isActiveFiltersSectionOpen, setIsActiveFiltersSectionOpen] = useState(() => getInitialSectionOpen(ACTIVE_FILTERS_SECTION_OPEN_KEY))
  const [isInsightsSectionOpen, setIsInsightsSectionOpen] = useState(() => getInitialSectionOpen(INSIGHTS_SECTION_OPEN_KEY))
  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE)
  const [visibleItemCountByDate, setVisibleItemCountByDate] = useState<Record<string, number>>({})
  const [statementMonthFilter, setStatementMonthFilter] = useState<string | null>(() => {
    const saved = localStorage.getItem(STATEMENT_MONTH_FILTER_KEY)
    if (!saved) return null
    return /^\d{4}-\d{2}$/.test(saved) ? saved : null
  })

  useEffect(() => {
    localStorage.setItem(FILTER_TYPE_KEY, filter)
  }, [filter])

  useEffect(() => {
    localStorage.setItem(METHOD_FILTER_KEY, methodFilter)
  }, [methodFilter])

  useEffect(() => {
    localStorage.setItem(BILLING_FILTER_KEY, billingFilter)
  }, [billingFilter])

  useEffect(() => {
    localStorage.setItem(FILTER_PANEL_OPEN_KEY, String(isFilterPanelOpen))
  }, [isFilterPanelOpen])

  useEffect(() => {
    localStorage.setItem(BALANCE_SECTION_OPEN_KEY, String(isBalanceSectionOpen))
  }, [isBalanceSectionOpen])

  useEffect(() => {
    localStorage.setItem(ACTIVE_FILTERS_SECTION_OPEN_KEY, String(isActiveFiltersSectionOpen))
  }, [isActiveFiltersSectionOpen])

  useEffect(() => {
    localStorage.setItem(INSIGHTS_SECTION_OPEN_KEY, String(isInsightsSectionOpen))
  }, [isInsightsSectionOpen])

  useEffect(() => {
    if (!statementMonthFilter) {
      localStorage.removeItem(STATEMENT_MONTH_FILTER_KEY)
      return
    }
    localStorage.setItem(STATEMENT_MONTH_FILTER_KEY, statementMonthFilter)
  }, [statementMonthFilter])

  useEffect(() => {
    let cancelled = false

    void loadSettings().then((settings) => {
      if (!cancelled) {
        const firstCredit = settings.userPaymentMethods.find((m) => m.type === 'credit')
        setCardBillingDay(firstCredit?.billingDay ?? settings.cardBillingDay ?? 25)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveBillingDay() {
    const val = parseInt(billingDayInput, 10)
    if (Number.isNaN(val) || val < 1 || val > 31) {
      showToast('결제일은 1~31 사이 숫자여야 해요.')
      return
    }
    try {
      const current = await loadSettings()
      await saveSettings({ ...current, cardBillingDay: val })
      setCardBillingDay(val)
      setEditingBillingDay(false)
      showToast(`카드 결제일이 ${val}일로 저장됐어요.`)
    } catch {
      showToast('카드 결제일 저장에 실패했어요.')
    }
  }

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(yearMonth)),
    [transactions, yearMonth]
  )

  const latestMonthDate = useMemo(() => {
    if (monthTx.length === 0) return `${yearMonth}-01`
    return monthTx.reduce((latest, t) => (t.date > latest ? t.date : latest), monthTx[0].date)
  }, [monthTx, yearMonth])

  const normalizedBaseDate = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const defaultDate = `${yearMonth}-01`
    if (!baseDate || !baseDate.startsWith(yearMonth)) return latestMonthDate || defaultDate

    const day = Number(baseDate.slice(8, 10))
    const daysInMonth = new Date(y, m, 0).getDate()
    const safeDay = Number.isFinite(day) ? Math.min(Math.max(day, 1), daysInMonth) : 1
    return `${yearMonth}-${String(safeDay).padStart(2, '0')}`
  }, [baseDate, yearMonth, latestMonthDate])

  const weekRange = useMemo(() => {
    const d = new Date(normalizedBaseDate)
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const toYmd = (date: Date) => date.toISOString().slice(0, 10)
    return { start: toYmd(start), end: toYmd(end) }
  }, [normalizedBaseDate])

  const monthLastDate = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    return `${yearMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  }, [yearMonth])

  const monthly = useMemo(
    () => {
      const normalizedSearch = debouncedSearch.replace(/^#/, '').toLowerCase()
      return monthTx
        .filter((t) => {
          if (periodMode === 'day') return t.date === normalizedBaseDate
          if (periodMode === 'week') return t.date >= weekRange.start && t.date <= weekRange.end
          return true
        })
        .filter((t) => filter === 'all' || t.type === filter)
        .filter((t) => {
          if (methodFilter === 'all') return true
          const isCardId = userPaymentMethods.some((m) => m.id === methodFilter)
          if (isCardId) {
            if (t.paymentMethodId) return t.paymentMethodId === methodFilter
            const matchingCard = userPaymentMethods.find((m) => m.id === methodFilter)
            if (!matchingCard) return false
            if (matchingCard.type === 'credit') return isCreditPaymentMethod(t.paymentMethod)
            return (t.paymentMethod ?? 'cash') === matchingCard.type
          }
          const method = t.paymentMethod ?? 'cash'
          if (methodFilter === 'credit') return isCreditPaymentMethod(method)
          return method === methodFilter
        })
        .filter((t) => {
          if (statementMonthFilter) {
            if (t.type !== 'expense' || !isCreditPaymentMethod(t.paymentMethod)) return false
            const statementYM = getStatementYMForCardExpense(t.date, resolveCardBillingDay(t, userPaymentMethods, cardBillingDay))
            if (statementYM !== statementMonthFilter) return false
          }

          if (billingFilter === 'all') return true
          if (t.type !== 'expense' || !isCreditPaymentMethod(t.paymentMethod)) return false
          const statementYM = getStatementYMForCardExpense(t.date, resolveCardBillingDay(t, userPaymentMethods, cardBillingDay))
          const stage = getBillingStage(yearMonth, statementYM)
          return stage === billingFilter
        })
        .filter((t) =>
          !debouncedSearch ||
          t.category.toLowerCase().includes(normalizedSearch) ||
          t.description.toLowerCase().includes(normalizedSearch) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedSearch))
        )
        .filter((t) => !activeTag || (t.tags ?? []).includes(activeTag))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    },
    [monthTx, periodMode, normalizedBaseDate, weekRange, filter, methodFilter, billingFilter, statementMonthFilter, debouncedSearch, activeTag, cardBillingDay, yearMonth, userPaymentMethods]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    monthly.forEach((t) => {
      const list = map.get(t.date) || []
      list.push(t)
      map.set(t.date, list)
    })
    return Array.from(map.entries())
  }, [monthly])

  const visibleGrouped = useMemo(
    () => grouped.slice(0, visibleGroupCount),
    [grouped, visibleGroupCount],
  )

  const hasMoreGroups = visibleGroupCount < grouped.length

  useEffect(() => {
    setVisibleGroupCount(GROUP_PAGE_SIZE)
    setVisibleItemCountByDate({})
  }, [
    yearMonth,
    filter,
    methodFilter,
    billingFilter,
    periodMode,
    normalizedBaseDate,
    weekRange.start,
    weekRange.end,
    statementMonthFilter,
    activeTag,
    debouncedSearch,
    viewMode,
  ])

  useEffect(() => {
    if (grouped.length === 0) return
    if (visibleGroupCount > grouped.length) {
      setVisibleGroupCount(Math.max(GROUP_PAGE_SIZE, grouped.length))
    }
  }, [grouped.length, visibleGroupCount])

  // 태그별 합계 (현재 필터 기준)
  const tagSummary = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>()
    monthly.forEach((t) => {
      const tags = t.tags ?? []
      tags.forEach((tag) => {
        const cur = map.get(tag) ?? { income: 0, expense: 0, count: 0 }
        if (t.type === 'income') cur.income += t.amount
        else cur.expense += t.amount
        cur.count += 1
        map.set(tag, cur)
      })
    })
    return Array.from(map.entries()).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
  }, [monthly])

  const { filteredIncome, filteredExpense } = useMemo(() => ({
    filteredIncome: monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    filteredExpense: monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }), [monthly])

  const maxExpenseAmount = useMemo(() => {
    const amounts = monthly.filter(t => t.type === 'expense').map(t => t.amount)
    return amounts.length ? Math.max(...amounts) : 0
  }, [monthly])

  const isFiltered = filter !== 'all' || methodFilter !== 'all' || billingFilter !== 'all' || !!statementMonthFilter || !!activeTag || !!search

  const activeFilterCount =
    (filter !== 'all' ? 1 : 0) +
    (methodFilter !== 'all' ? 1 : 0) +
    (billingFilter !== 'all' ? 1 : 0) +
    (statementMonthFilter ? 1 : 0) +
    (activeTag ? 1 : 0) +
    (search ? 1 : 0)

  const methodSummary = useMemo(() => {
    const map: Record<'cash' | 'check' | 'credit', { income: number; expense: number }> = {
      cash: { income: 0, expense: 0 },
      check: { income: 0, expense: 0 },
      credit: { income: 0, expense: 0 },
    }

    monthly.forEach((t) => {
      const { type: method } = resolvePaymentMethod(t, userPaymentMethods)
      if (t.type === 'income') map[method].income += t.amount
      else map[method].expense += t.amount
    })

    return map
  }, [monthly, userPaymentMethods])

  const methodsNetTotal = useMemo(() => {
    return (['cash', 'check', 'credit'] as const).reduce(
      (sum, method) => sum + methodSummary[method].income - methodSummary[method].expense,
      0,
    )
  }, [methodSummary])

  const insightSummary = useMemo(() => {
    if (monthly.length < 3) return null
    const expenses = monthly.filter((t) => t.type === 'expense')
    if (!expenses.length) return null

    const catMap: Record<string, number> = {}
    expenses.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount
    })

    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]
    const avgAmt = Math.round(monthly.reduce((s, t) => s + t.amount, 0) / monthly.length)
    const maxTx = expenses.reduce((a, b) => (b.amount > a.amount ? b : a), expenses[0])

    return { topCat, avgAmt, maxTx }
  }, [monthly])

  const insightHeaderText = useMemo(() => {
    if (isFiltered && monthly.length > 0) return `${monthly.length}건`
    if (insightSummary) return `최다 ${insightSummary.topCat[0]}`
    return '요약 없음'
  }, [isFiltered, monthly.length, insightSummary])

  const periodLabel = periodMode === 'day' ? '일' : periodMode === 'week' ? '주' : '월'

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (dateStr === today) return '오늘'
    if (dateStr === yesterday) return '어제'
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
  }

  function getDayBalance(list: Transaction[]) {
    const inc = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return inc - exp
  }

  function formatWeekRangeLabel(startDate: string, endDate: string) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
  }

  function resetAllFilters() {
    setFilter('all')
    setMethodFilter('all')
    setBillingFilter('all')
    setStatementMonthFilter(null)
    setActiveTag(null)
    setSearch('')
  }

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag))
  }

  function applyQuickPreset(preset: QuickFilterPreset) {
    setActiveTag(null)
    setSearch('')
    setStatementMonthFilter(null)

    if (preset === 'all') {
      setFilter('all')
      setMethodFilter('all')
      setBillingFilter('all')
      return
    }

    if (preset === 'cash-expense') {
      setFilter('expense')
      setMethodFilter('cash')
      setBillingFilter('all')
      return
    }

    if (preset === 'check-expense') {
      setFilter('expense')
      setMethodFilter('check')
      setBillingFilter('all')
      return
    }

    if (preset === 'credit-current') {
      setFilter('expense')
      setMethodFilter('credit')
      setBillingFilter('current')
      return
    }

    setFilter('expense')
    setMethodFilter('credit')
    setBillingFilter('next')
  }

  function isQuickPresetActive(preset: QuickFilterPreset): boolean {
    if (preset === 'all') {
      return filter === 'all'
        && methodFilter === 'all'
        && billingFilter === 'all'
        && !statementMonthFilter
        && !activeTag
        && !search
    }
    if (preset === 'cash-expense') return filter === 'expense' && methodFilter === 'cash' && billingFilter === 'all' && !statementMonthFilter
    if (preset === 'check-expense') return filter === 'expense' && methodFilter === 'check' && billingFilter === 'all' && !statementMonthFilter
    if (preset === 'credit-current') return filter === 'expense' && methodFilter === 'credit' && billingFilter === 'current' && !statementMonthFilter
    return filter === 'expense' && methodFilter === 'credit' && billingFilter === 'next' && !statementMonthFilter
  }

  return (
    <div className="space-y-3 tab-content">
      {/* 뷰 전환 + 내보내기 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-[#1C1C1E] rounded-2xl p-1 gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'
              }`}
          >
            <ListIcon size={13} /> 목록
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'
              }`}
          >
            <CalendarDays size={13} /> 캘린더
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {onBulkDelete && (
            <button
              onClick={() => { setIsSelectionMode((v) => !v); setSelectedIds(new Set()) }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${isSelectionMode ? 'bg-[#3D8EF8]/20 text-[#3D8EF8]' : 'bg-[#1C1C1E] text-[#8B95A1] hover:text-white'}`}
            >
              <CheckSquare size={13} /> {isSelectionMode ? '취소' : '선택'}
            </button>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] hover:text-white text-xs font-bold transition-colors"
          >
            <FileDown size={13} /> 내보내기
          </button>
        </div>
      </div>

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <CalendarView
          transactions={transactions}
          yearMonth={yearMonth}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* 목록 뷰 */}
      {viewMode === 'list' && <>
        <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden sticky top-2 z-20 shadow-[0_6px_18px_rgba(0,0,0,0.22)] sm:static sm:shadow-none">
          <div className="flex items-center gap-2 px-3 py-3">
            <button
              onClick={() => setIsFilterPanelOpen((v) => !v)}
              className="flex-1 min-w-0 flex items-center justify-between px-2 py-0 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-white">필터 컨트롤</span>
                <span className="text-xs text-[#8B95A1] font-semibold truncate">{periodLabel} 단위 · 활성 {activeFilterCount}개</span>
              </div>
              {isFilterPanelOpen ? <ChevronUp size={14} className="text-[#4E5968] shrink-0" /> : <ChevronDown size={14} className="text-[#4E5968] shrink-0" />}
            </button>
            {isFiltered && (
              <button
                onClick={resetAllFilters}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-[#2C2C2E] text-[#8B95A1] font-bold hover:text-white hover:bg-[#3A3A3C] transition-colors"
              >
                초기화
              </button>
            )}
          </div>

          {isFilterPanelOpen && (
            <div className="space-y-3 px-3 pb-3">
              <div className="bg-[#2C2C2E] rounded-2xl p-2 space-y-2">
                <div className="flex gap-1">
                  {([
                    { key: 'day', label: '일' },
                    { key: 'week', label: '주' },
                    { key: 'month', label: '월' },
                  ] as { key: PeriodMode; label: string }[]).map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => {
                        setPeriodMode(mode.key)
                        setBaseDate(latestMonthDate)
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${periodMode === mode.key
                        ? 'bg-[#3D8EF8] text-white'
                        : 'text-[#4E5968] hover:text-[#8B95A1]'
                        }`}
                    >
                      {mode.label} 단위
                    </button>
                  ))}
                </div>

                {periodMode !== 'month' && (
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="w-48 shrink-0">
                      <FancyDatePicker
                        value={normalizedBaseDate}
                        onChange={setBaseDate}
                        min={`${yearMonth}-01`}
                        max={monthLastDate}
                        size="sm"
                      />
                    </div>
                    {periodMode === 'day' ? (
                      <span className="text-xs text-[#8B95A1] font-semibold">선택한 하루만 표시</span>
                    ) : (
                      <span className="text-xs text-[#8B95A1] font-semibold">{formatWeekRangeLabel(weekRange.start, weekRange.end)}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[#2C2C2E] rounded-2xl p-1 grid grid-cols-3 gap-1">
                {([
                  { key: 'all', label: '전체' },
                  { key: 'credit-current', label: '카드 이번' },
                  { key: 'credit-next', label: '카드 다음' },
                  { key: 'cash-expense', label: '현금 지출' },
                  { key: 'check-expense', label: '체크 지출' },
                ] as { key: QuickFilterPreset; label: string }[]).map((preset) => {
                  const active = isQuickPresetActive(preset.key)
                  return (
                    <button
                      key={preset.key}
                      onClick={() => applyQuickPreset(preset.key)}
                      className={`py-2 rounded-xl text-[11px] font-bold transition-all ${active
                        ? 'bg-[#3D8EF8] text-white'
                        : 'text-[#8B95A1] hover:text-[#C8D1DC] hover:bg-[#3A3A3C]'
                        }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>

              {/* 검색 */}
              <div role="search" className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4E5968]" />
                <input
                  type="text"
                  aria-label="내역 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="카테고리, 설명, #태그로 검색"
                  className="w-full bg-[#2C2C2E] text-white placeholder-[#4E5968] text-sm font-medium rounded-2xl pl-10 pr-10 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="absolute right-4 top-1/2 -translate-y-1/2">
                    <X size={14} className="text-[#4E5968]" />
                  </button>
                )}
              </div>

              {/* 필터 탭 */}
              <div className="bg-[#2C2C2E] rounded-2xl p-1 flex">
                {(['all', 'income', 'expense'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${filter === f
                      ? 'bg-[#3D8EF8] text-white'
                      : 'text-[#4E5968] hover:text-[#8B95A1]'
                      }`}
                  >
                    {f === 'all' ? '전체' : f === 'income' ? '수입' : '지출'}
                  </button>
                ))}
              </div>

              <div className="bg-[#2C2C2E] rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-[#8B95A1] font-semibold">카드 결제일</span>
                  <span className="text-xs text-[#9CC7FF] font-bold">매월 {cardBillingDay}일</span>
                </div>
                {!editingBillingDay ? (
                  <button
                    onClick={() => {
                      setBillingDayInput(String(cardBillingDay))
                      setEditingBillingDay(true)
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#3D8EF8]/20 text-[#79B2FF] font-bold hover:bg-[#3D8EF8]/30 transition-colors"
                  >
                    변경
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={billingDayInput}
                      onChange={(e) => setBillingDayInput(e.target.value)}
                      className="w-12 bg-[#1C1C1E] text-white text-center rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                    />
                    <button onClick={() => { void handleSaveBillingDay() }} className="text-[11px] px-2 py-1 rounded-lg bg-[#3D8EF8] text-white font-bold">저장</button>
                    <button onClick={() => setEditingBillingDay(false)} className="text-[11px] px-2 py-1 rounded-lg bg-[#1C1C1E] text-[#8B95A1] font-bold">취소</button>
                  </div>
                )}
              </div>

              {statementMonthFilter && (
                <div className="bg-[#2C2C2E] rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#9CC7FF] font-bold">청구월 필터: {statementMonthFilter}</span>
                  <button
                    onClick={() => setStatementMonthFilter(null)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1C1C1E] text-[#8B95A1] font-bold hover:text-white hover:bg-[#3A3A3C] transition-colors"
                  >
                    해제
                  </button>
                </div>
              )}

              {userPaymentMethods.length > 0 ? (
                <div className={`bg-[#2C2C2E] rounded-2xl p-1 ${userPaymentMethods.length > 4 ? 'grid grid-cols-3 gap-1' : 'flex'}`}>
                  <button
                    onClick={() => setMethodFilter('all')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${methodFilter === 'all' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'}`}
                  >
                    전체
                  </button>
                  {userPaymentMethods.map((m) => {
                    const isSelected = methodFilter === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMethodFilter(m.id)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all truncate px-1 ${isSelected
                          ? m.type === 'cash'
                            ? 'bg-[#2ACF6A]/22 text-[#2ACF6A]'
                            : m.type === 'check'
                              ? 'bg-[#6AD3C0]/22 text-[#6AD3C0]'
                              : 'bg-[#3D8EF8]/22 text-[#79B2FF]'
                          : 'text-[#4E5968] hover:text-[#8B95A1]'
                        }`}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-[#2C2C2E] rounded-2xl p-1 flex">
                  {([
                    { key: 'all', label: '결제수단 전체' },
                    { key: 'cash', label: '현금' },
                    { key: 'check', label: '체크카드' },
                    { key: 'credit', label: '신용카드' },
                  ] as { key: MethodFilterType; label: string }[]).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setMethodFilter(f.key)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${methodFilter === f.key
                        ? f.key === 'cash'
                          ? 'bg-[#2ACF6A]/22 text-[#2ACF6A]'
                          : f.key === 'check'
                            ? 'bg-[#6AD3C0]/22 text-[#6AD3C0]'
                            : f.key === 'credit'
                            ? 'bg-[#3D8EF8]/22 text-[#79B2FF]'
                            : 'bg-[#3D8EF8] text-white'
                        : 'text-[#4E5968] hover:text-[#8B95A1]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-[#2C2C2E] rounded-2xl p-1 flex">
                {([
                  { key: 'all', label: '청구 전체' },
                  { key: 'current', label: '이번 청구' },
                  { key: 'next', label: '다음 청구' },
                  { key: 'later', label: '이후 청구' },
                ] as { key: BillingFilterType; label: string }[]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setBillingFilter(f.key)
                      setStatementMonthFilter(null)
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${billingFilter === f.key
                      ? f.key === 'current'
                        ? 'bg-[#F5BE3A]/22 text-[#F5BE3A]'
                        : f.key === 'next'
                          ? 'bg-[#3D8EF8]/22 text-[#79B2FF]'
                          : f.key === 'later'
                            ? 'bg-[#8B95A1]/22 text-[#B9C0C8]'
                            : 'bg-[#3D8EF8] text-white'
                      : 'text-[#4E5968] hover:text-[#8B95A1]'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 결제수단별 잔액 */}
        <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsBalanceSectionOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-white">결제수단별 잔액</span>
              <span className={`text-xs font-bold num ${methodsNetTotal > 0 ? 'text-[#9CC7FF]' : methodsNetTotal < 0 ? 'text-[#FF8D98]' : 'text-[#8B95A1]'}`}>
                {methodsNetTotal >= 0 ? '+' : ''}{fmt(methodsNetTotal)}원
              </span>
            </div>
            {isBalanceSectionOpen ? <ChevronUp size={14} className="text-[#4E5968] shrink-0" /> : <ChevronDown size={14} className="text-[#4E5968] shrink-0" />}
          </button>

          {isBalanceSectionOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 pb-3">
              {userPaymentMethods.length > 0 ? (
                (['cash', 'check', 'credit'] as const)
                  .filter((t) => userPaymentMethods.some((m) => m.type === t))
                  .map((methodType) => {
                    const label = userPaymentMethods.find((m) => m.type === methodType)?.label
                      ?? PAYMENT_METHOD_LABEL[methodType]
                    const income = methodSummary[methodType].income
                    const expense = methodSummary[methodType].expense
                    const net = income - expense
                    return (
                      <div key={methodType} className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
                        <p className="text-[11px] text-[#8B95A1] font-semibold mb-1">{label} 잔액</p>
                        <p className={`text-[15px] font-extrabold num ${net >= 0 ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                          {net >= 0 ? '+' : ''}{fmt(net)}원
                        </p>
                        <p className="text-[10px] text-[#4E5968] mt-1">
                          수입 +{fmt(income)} / 지출 -{fmt(expense)}
                        </p>
                      </div>
                    )
                  })
              ) : (
                (['cash', 'check', 'credit'] as const).map((method) => {
                  const income = methodSummary[method].income
                  const expense = methodSummary[method].expense
                  const net = income - expense
                  return (
                    <div key={method} className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
                      <p className="text-[11px] text-[#8B95A1] font-semibold mb-1">{PAYMENT_METHOD_LABEL[method]} 잔액</p>
                      <p className={`text-[15px] font-extrabold num ${net >= 0 ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                        {net >= 0 ? '+' : ''}{fmt(net)}원
                      </p>
                      <p className="text-[10px] text-[#4E5968] mt-1">
                        수입 +{fmt(income)} / 지출 -{fmt(expense)}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {tagSummary.length > 0 && (
          <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowTagSummary((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            >
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-[#3D8EF8]" />
                <span className="text-sm font-bold text-white">태그별 합계</span>
                {activeTag && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-[#3D8EF8]/20 text-[#3D8EF8] font-semibold">
                    #{activeTag} 필터 중
                  </span>
                )}
              </div>
              {showTagSummary ? <ChevronUp size={14} className="text-[#4E5968]" /> : <ChevronDown size={14} className="text-[#4E5968]" />}
            </button>

            {showTagSummary && (
              <div className="px-4 pb-4 space-y-1.5">
                {tagSummary.map(([tag, stat]) => {
                  const net = stat.income - stat.expense
                  const isActive = activeTag === tag
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${isActive
                        ? 'bg-[#3D8EF8]/20 ring-1 ring-[#3D8EF8]/40'
                        : 'bg-[#2C2C2E] hover:bg-[#3A3A3C]'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isActive ? 'text-[#3D8EF8]' : 'text-white'}`}>
                          #{tag}
                        </span>
                        <span className="text-xs text-[#4E5968] font-medium">{stat.count}건</span>
                      </div>
                      <div className="text-right">
                        {stat.income > 0 && (
                          <div className="text-xs font-bold text-[#2ACF6A] num">+{fmt(stat.income)}원</div>
                        )}
                        {stat.expense > 0 && (
                          <div className="text-xs font-bold text-[#F25260] num">-{fmt(stat.expense)}원</div>
                        )}
                        {stat.income > 0 && stat.expense > 0 && (
                          <div className={`text-[11px] font-bold num ${net >= 0 ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}>
                            순 {net >= 0 ? '+' : ''}{fmt(net)}원
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
                {activeTag && (
                  <button
                    onClick={() => setActiveTag(null)}
                    className="w-full text-xs font-bold text-[#4E5968] hover:text-[#8B95A1] py-1.5 transition-colors"
                  >
                    필터 해제
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 활성 필터 뱃지 */}
        {isFiltered && (
          <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
            <button
              onClick={() => setIsActiveFiltersSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-white">활성 필터 {activeFilterCount}개</span>
                <span className="text-xs text-[#8B95A1] font-semibold num">{fmt(monthly.length)}건</span>
              </div>
              {isActiveFiltersSectionOpen ? <ChevronUp size={14} className="text-[#4E5968] shrink-0" /> : <ChevronDown size={14} className="text-[#4E5968] shrink-0" />}
            </button>

            {isActiveFiltersSectionOpen && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                {filter !== 'all' && (
                  <button
                    onClick={() => setFilter('all')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3D8EF8]/20 text-[#79B2FF] text-[11px] font-bold"
                  >
                    {filter === 'income' ? '수입' : '지출'} <X size={10} />
                  </button>
                )}
                {methodFilter !== 'all' && (
                  <button
                    onClick={() => setMethodFilter('all')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3D8EF8]/20 text-[#79B2FF] text-[11px] font-bold"
                  >
                    {userPaymentMethods.find(m => m.id === methodFilter)?.label ?? PAYMENT_METHOD_LABEL[methodFilter as 'cash' | 'check' | 'credit'] ?? methodFilter} <X size={10} />
                  </button>
                )}
                {billingFilter !== 'all' && (
                  <button
                    onClick={() => setBillingFilter('all')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5BE3A]/20 text-[#F5BE3A] text-[11px] font-bold"
                  >
                    {billingFilter === 'current' ? '이번 청구' : billingFilter === 'next' ? '다음 청구' : '이후 청구'} <X size={10} />
                  </button>
                )}
                {statementMonthFilter && (
                  <button
                    onClick={() => setStatementMonthFilter(null)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#9CC7FF]/20 text-[#9CC7FF] text-[11px] font-bold"
                  >
                    청구월 {statementMonthFilter} <X size={10} />
                  </button>
                )}
                {activeTag && (
                  <button
                    onClick={() => setActiveTag(null)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3D8EF8]/20 text-[#79B2FF] text-[11px] font-bold"
                  >
                    #{activeTag} <X size={10} />
                  </button>
                )}
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#2C2C2E] text-[#8B95A1] text-[11px] font-bold"
                  >
                    "{search}" <X size={10} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {(isFiltered && monthly.length > 0) || insightSummary ? (
          <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
            <button
              onClick={() => setIsInsightsSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-white">요약 인사이트</span>
                <span className="text-xs text-[#8B95A1] font-semibold truncate">{insightHeaderText}</span>
              </div>
              {isInsightsSectionOpen ? <ChevronUp size={14} className="text-[#4E5968] shrink-0" /> : <ChevronDown size={14} className="text-[#4E5968] shrink-0" />}
            </button>

            {isInsightsSectionOpen && (
              <div className="space-y-2 px-3 pb-3">
                {/* 필터 결과 합계 */}
                {isFiltered && monthly.length > 0 && (
                  <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#8B95A1] font-semibold">{monthly.length}건</span>
                    <div className="flex gap-3">
                      {filteredIncome > 0 && <span className="text-xs font-bold text-[#2ACF6A] num">+{fmt(filteredIncome)}</span>}
                      {filteredExpense > 0 && <span className="text-xs font-bold text-[#F25260] num">-{fmt(filteredExpense)}</span>}
                    </div>
                  </div>
                )}

                {insightSummary && (
                  <div className="flex gap-2 mb-1">
                    <div className="flex-1 bg-[#2C2C2E] rounded-2xl px-3 py-2.5">
                      <p className="text-[9px] text-[#4E5968] mb-1">최다 지출</p>
                      <p className="text-[11px] font-bold text-white truncate">{CATEGORY_EMOJI[insightSummary.topCat[0]] ?? '📦'} {insightSummary.topCat[0]}</p>
                      <p className="text-[9px] num text-[#F25260]">{fmt(insightSummary.topCat[1])}원</p>
                    </div>
                    <div className="flex-1 bg-[#2C2C2E] rounded-2xl px-3 py-2.5">
                      <p className="text-[9px] text-[#4E5968] mb-1">평균 거래</p>
                      <p className="text-[12px] font-bold num text-white">{fmt(insightSummary.avgAmt)}</p>
                      <p className="text-[9px] text-[#4E5968]">원/건</p>
                    </div>
                    <div className="flex-1 bg-[#2C2C2E] rounded-2xl px-3 py-2.5">
                      <p className="text-[9px] text-[#4E5968] mb-1">최대 단건</p>
                      <p className="text-[11px] font-bold text-white truncate">{CATEGORY_EMOJI[insightSummary.maxTx.category] ?? '📦'} {insightSummary.maxTx.category}</p>
                      <p className="text-[9px] num text-[#F25260]">{fmt(insightSummary.maxTx.amount)}원</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {grouped.length === 0 ? (
          <div className="bg-[#1C1C1E] rounded-2xl p-12 text-center">
            <p className="text-5xl mb-4">{search || activeTag ? '🔍' : '📋'}</p>
            <p className="font-bold text-white text-[15px]">
              {activeTag ? `#${activeTag} 태그 내역 없음` : search ? `"${search}" 검색 결과 없음` : '내역이 없어요'}
            </p>
            {(filter !== 'all' || methodFilter !== 'all' || billingFilter !== 'all' || statementMonthFilter !== null || !!activeTag || !!search) && (
              <button
                onClick={resetAllFilters}
                className="mt-4 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] transition-colors"
              >
                필터 전체 초기화
              </button>
            )}
          </div>
        ) : (
          visibleGrouped.map(([date, list]) => {
            const dayBalance = getDayBalance(list)
            const visibleItemCount = visibleItemCountByDate[date] ?? ITEM_PAGE_SIZE
            const visibleItems = list.slice(0, visibleItemCount)
            const hasMoreItemsInDate = visibleItemCount < list.length
            return (
              <div key={date} className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
                {/* 날짜 헤더 */}
                <button
                  className="w-full flex items-center justify-between px-5 pt-4 pb-3 text-left"
                  onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(date)) next.delete(date)
                    else next.add(date)
                    return next
                  })}
                >
                  <span className="text-sm font-bold text-white">{formatDate(date)}</span>
                  <div className="flex items-center gap-2">
                    {list.some(t => t.type === 'income') && (
                      <span className="text-[11px] font-bold num text-[#2ACF6A]">+{fmt(list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}</span>
                    )}
                    {list.some(t => t.type === 'expense') && (
                      <span className="text-[11px] font-bold num text-[#F25260]">-{fmt(list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</span>
                    )}
                    <span className={`text-[11px] font-bold num pl-1 border-l border-white/10 ${dayBalance >= 0 ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                      {dayBalance >= 0 ? '+' : ''}{fmt(dayBalance)}
                    </span>
                    <ChevronDown size={13} className={`text-[#4E5968] transition-transform duration-200 shrink-0 ${collapsedGroups.has(date) ? '-rotate-90' : ''}`} />
                  </div>
                </button>

                {!collapsedGroups.has(date) && <div>
                  {visibleItems.map((t, idx) => {
                    const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                    const tags = t.tags ?? []
                    const isSwiped = swipedId === t.id
                    return (
                      <div key={t.id} className={`relative overflow-hidden list-item-enter ${idx < visibleItems.length - 1 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''}`} style={{ animationDelay: `${Math.min(idx, 9) * 30}ms`, borderLeft: t.type === 'expense' && maxExpenseAmount > 0 ? `3px solid rgba(242,82,96,${(0.25 + (t.amount / maxExpenseAmount) * 0.75).toFixed(2)})` : undefined }}>
                        {/* 스와이프 액션 패널 */}
                        <div className={`absolute right-0 top-0 bottom-0 flex items-center gap-1 px-3 transition-all duration-200 ${isSwiped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(t); setSwipedId(null) }}
                            className="w-10 h-10 rounded-xl bg-[#3D8EF8]/20 flex items-center justify-center text-[#3D8EF8]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(t.id); setSwipedId(null) }}
                            className="w-10 h-10 rounded-xl bg-[#F25260]/20 flex items-center justify-center text-[#F25260]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      <div
                        style={{ transform: isSwiped ? 'translateX(-88px)' : 'translateX(0)', transition: 'transform 0.2s ease' }}
                        onClick={() => {
                          if (isSelectionMode) {
                            setSelectedIds((prev) => {
                              const next = new Set(prev)
                              next.has(t.id) ? next.delete(t.id) : next.add(t.id)
                              return next
                            })
                            return
                          }
                          setSwipedId(null); if (!isSwiped) setDetailTransaction(t)
                        }}
                        onTouchStart={(e) => { if (!isSelectionMode) touchStartX.current = e.touches[0].clientX }}
                        onTouchEnd={(e) => {
                          if (isSelectionMode) return
                          const delta = e.changedTouches[0].clientX - touchStartX.current
                          if (delta < -50) setSwipedId(t.id)
                          else if (delta > 20) setSwipedId(null)
                        }}
                        className="flex items-center gap-3 px-5 py-3.5 group cursor-pointer hover:bg-white/2 transition-colors bg-[#1C1C1E]"
                      >
                        {isSelectionMode && (
                          <div className="shrink-0 text-[#3D8EF8]">
                            {selectedIds.has(t.id) ? <CheckSquare size={20} /> : <Square size={20} className="text-[#4E5968]" />}
                          </div>
                        )}
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: color.bg }}
                        >
                          {CATEGORY_EMOJI[t.category] ?? '📦'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <HighlightText text={t.category} query={debouncedSearch} className="text-[14px] font-semibold text-white leading-tight" />
                          {t.description && (
                            <HighlightText text={t.description} query={debouncedSearch} className="text-xs text-[#4E5968] truncate mt-0.5 block" />
                          )}
                          {(() => {
                            const resolved = resolvePaymentMethod(t, userPaymentMethods)
                            const emoji = resolved.type === 'cash' ? '💵' : resolved.type === 'check' ? '💳' : '💎'
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] mt-1 font-bold ${resolved.type === 'credit'
                                ? 'bg-[#3D8EF8]/18 text-[#79B2FF]'
                                : resolved.type === 'check'
                                  ? 'bg-[#6AD3C0]/20 text-[#6AD3C0]'
                                  : 'bg-[#2ACF6A]/18 text-[#2ACF6A]'
                              }`}>
                                {emoji} {resolved.label}
                              </span>
                            )
                          })()}
                          {t.type === 'expense' && isCreditPaymentMethod(t.paymentMethod) && (() => {
                            const txBillingDay = resolveCardBillingDay(t, userPaymentMethods, cardBillingDay)
                            const statementYM = getStatementYMForCardExpense(t.date, txBillingDay)
                            const stage = getBillingStage(yearMonth, statementYM)
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] mt-1 ml-1 font-bold ${stage === 'current'
                                ? 'bg-[#F5BE3A]/20 text-[#F5BE3A]'
                                : stage === 'next'
                                  ? 'bg-[#3D8EF8]/20 text-[#79B2FF]'
                                  : 'bg-[#8B95A1]/20 text-[#B9C0C8]'
                                }`}
                                title={`결제일 ${txBillingDay}일 기준 · ${statementYM} 청구`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setStatementMonthFilter(statementYM)
                                  setMethodFilter('credit')
                                }}
                              >
                                {stage === 'current' ? '이번 청구' : stage === 'next' ? '다음 청구' : `${statementYM.slice(5)}월 청구`}
                              </span>
                            )
                          })()}
                          {t.dateEnd && (
                            <p className="text-[10px] text-[#3D8EF8] font-semibold mt-0.5">
                              ~ {(() => { const [, m, d] = t.dateEnd.split('-'); return `${parseInt(m)}.${d}` })()}까지
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={(e) => { e.stopPropagation(); handleTagClick(tag) }}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${activeTag === tag
                                    ? 'bg-[#3D8EF8]/30 text-[#3D8EF8]'
                                    : 'bg-[#2C2C2E] text-[#5A8EC8] hover:bg-[#3D8EF8]/15 hover:text-[#3D8EF8]'
                                    }`}
                                >
                                  #<HighlightText text={tag} query={debouncedSearch} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className="text-[14px] font-bold num"
                            style={{ color: t.type === 'income' ? '#2ACF6A' : '#F1F3F6' }}
                          >
                            {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}원
                          </span>

                          {/* 영수증 아이콘 */}
                          {t.receiptImageUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setReceiptModal({ open: true, url: t.receiptImageUrl! }) }}
                              className="p-1.5 rounded-xl hover:bg-[#3D8EF8]/15 text-[#3D8EF8] transition-colors"
                              title="영수증 보기"
                            >
                              📷
                            </button>
                          )}

                          <div className="flex gap-0.5 ml-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit(t) }}
                              aria-label={`${t.category} 내역 수정`}
                              className="p-2.5 rounded-xl hover:bg-[#3D8EF8]/15 text-[#4E5968] hover:text-[#3D8EF8] transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(t.id) }}
                              aria-label={`${t.category} 내역 삭제`}
                              className="p-2.5 rounded-xl hover:bg-[#F25260]/15 text-[#4E5968] hover:text-[#F25260] transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                      </div>
                    )
                  })}

                  {hasMoreItemsInDate && (
                    <div className="px-4 pb-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setVisibleItemCountByDate((prev) => ({
                          ...prev,
                          [date]: (prev[date] ?? ITEM_PAGE_SIZE) + ITEM_PAGE_SIZE,
                        }))}
                        className="w-full py-2 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white text-xs font-bold transition-colors"
                      >
                        이 날짜 내역 더 보기 ({visibleItems.length}/{list.length})
                      </button>
                    </div>
                  )}
                </div>}
              </div>
            )
          })
        )}

        {viewMode === 'list' && hasMoreGroups && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setVisibleGroupCount((prev) => prev + GROUP_PAGE_SIZE)}
              className="px-4 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] hover:text-white text-xs font-bold transition-colors"
            >
              내역 더 보기 ({visibleGrouped.length}/{grouped.length})
            </button>
          </div>
        )}

      </> /* end list view */}

      {/* 일괄 삭제 액션바 */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center z-30 px-4">
          <div className="flex items-center gap-3 bg-[#1C1C1E] border border-white/10 rounded-3xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <span className="text-white font-bold text-sm">{selectedIds.size}개 선택됨</span>
            <button
              onClick={() => {
                if (onBulkDelete) onBulkDelete([...selectedIds])
                setIsSelectionMode(false)
                setSelectedIds(new Set())
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#F25260]/20 text-[#F25260] font-bold text-sm"
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>
      )}

      {/* 내역 상세 모달 */}
      {detailTransaction && (
        <TransactionDetailModal
          transaction={detailTransaction}
          userPaymentMethods={userPaymentMethods}
          onEdit={(t) => { setDetailTransaction(null); onEdit(t) }}
          onDelete={(id) => { setDetailTransaction(null); onDelete(id) }}
          onClose={() => setDetailTransaction(null)}
        />
      )}

      {/* 영수증 모달 */}
      {receiptModal.open && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setReceiptModal({ open: false, url: '' })}
        >
          <img
            src={receiptModal.url}
            alt="영수증"
            className="max-w-full max-h-[90vh] rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showExport && (
        <ExportModal
          transactions={transactions}
          yearMonth={yearMonth}
          onClose={() => setShowExport(false)}
          onArchiveDone={(cutoff) => {
            setShowExport(false)
            onArchiveDone?.(cutoff)
          }}
        />
      )}
    </div>
  )
}
