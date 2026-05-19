import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Search, X, CalendarDays, List as ListIcon, FileDown, Hash, ChevronDown, ChevronUp } from 'lucide-react'
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
  onArchiveDone?: (cutoff: string) => void
}

type ViewMode = 'list' | 'calendar'

type FilterType = 'all' | 'income' | 'expense'
type MethodFilterType = 'all' | 'cash' | 'check' | 'credit' | string
type BillingFilterType = 'all' | 'current' | 'next' | 'later'
type PeriodMode = 'day' | 'week' | 'month'

const METHOD_FILTER_KEY = 'hb_tx_method_filter'
const BILLING_FILTER_KEY = 'hb_tx_billing_filter'
const STATEMENT_MONTH_FILTER_KEY = 'hb_tx_statement_month_filter'

export default function TransactionList({ transactions, yearMonth, userPaymentMethods = [], onEdit, onDelete, onArchiveDone }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
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
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showExport, setShowExport] = useState(false)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [baseDate, setBaseDate] = useState(`${yearMonth}-01`)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showTagSummary, setShowTagSummary] = useState(false)
  const [receiptModal, setReceiptModal] = useState({ open: false, url: '' })
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null)
  const [cardBillingDay, setCardBillingDay] = useState(25)
  const [editingBillingDay, setEditingBillingDay] = useState(false)
  const [billingDayInput, setBillingDayInput] = useState('25')
  const [statementMonthFilter, setStatementMonthFilter] = useState<string | null>(() => {
    const saved = localStorage.getItem(STATEMENT_MONTH_FILTER_KEY)
    if (!saved) return null
    return /^\d{4}-\d{2}$/.test(saved) ? saved : null
  })

  useEffect(() => {
    localStorage.setItem(METHOD_FILTER_KEY, methodFilter)
  }, [methodFilter])

  useEffect(() => {
    localStorage.setItem(BILLING_FILTER_KEY, billingFilter)
  }, [billingFilter])

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
      const normalizedSearch = search.replace(/^#/, '').toLowerCase()
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
          !search ||
          t.category.toLowerCase().includes(normalizedSearch) ||
          t.description.toLowerCase().includes(normalizedSearch) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedSearch))
        )
        .filter((t) => !activeTag || (t.tags ?? []).includes(activeTag))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    },
    [monthTx, periodMode, normalizedBaseDate, weekRange, filter, methodFilter, billingFilter, statementMonthFilter, search, activeTag, cardBillingDay, yearMonth, userPaymentMethods]
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

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag))
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
        <button
          onClick={() => setShowExport(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] hover:text-white text-xs font-bold transition-colors"
        >
          <FileDown size={13} /> 내보내기
        </button>
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

        <div className="bg-[#1C1C1E] rounded-2xl p-2 space-y-2">
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

        {/* 검색 */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4E5968]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="카테고리, 설명, #태그로 검색"
            className="w-full bg-[#1C1C1E] text-white placeholder-[#4E5968] text-sm font-medium rounded-2xl pl-10 pr-10 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="absolute right-4 top-1/2 -translate-y-1/2">
              <X size={14} className="text-[#4E5968]" />
            </button>
          )}
        </div>

        {/* 필터 탭 */}
        <div className="bg-[#1C1C1E] rounded-2xl p-1 flex">
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

        <div className="bg-[#1C1C1E] rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2">
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
                className="w-12 bg-[#2C2C2E] text-white text-center rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
              />
              <button onClick={() => { void handleSaveBillingDay() }} className="text-[11px] px-2 py-1 rounded-lg bg-[#3D8EF8] text-white font-bold">저장</button>
              <button onClick={() => setEditingBillingDay(false)} className="text-[11px] px-2 py-1 rounded-lg bg-[#2C2C2E] text-[#8B95A1] font-bold">취소</button>
            </div>
          )}
        </div>

        {statementMonthFilter && (
          <div className="bg-[#1C1C1E] rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[#9CC7FF] font-bold">청구월 필터: {statementMonthFilter}</span>
            <button
              onClick={() => setStatementMonthFilter(null)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#2C2C2E] text-[#8B95A1] font-bold hover:text-white hover:bg-[#3A3A3C] transition-colors"
            >
              해제
            </button>
          </div>
        )}

        {userPaymentMethods.length > 0 ? (
          <div className={`bg-[#1C1C1E] rounded-2xl p-1 ${userPaymentMethods.length > 4 ? 'grid grid-cols-3 gap-1' : 'flex'}`}>
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
          <div className="bg-[#1C1C1E] rounded-2xl p-1 flex">
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

        <div className="bg-[#1C1C1E] rounded-2xl p-1 flex">
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

        {/* 결제수단별 잔액 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  <div key={methodType} className="bg-[#1C1C1E] rounded-2xl px-4 py-3">
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
                <div key={method} className="bg-[#1C1C1E] rounded-2xl px-4 py-3">
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

        {grouped.length === 0 ? (
          <div className="bg-[#1C1C1E] rounded-2xl p-12 text-center">
            <p className="text-5xl mb-4">{search || activeTag ? '🔍' : '📋'}</p>
            <p className="font-bold text-white text-[15px]">
              {activeTag ? `#${activeTag} 태그 내역 없음` : search ? `"${search}" 검색 결과 없음` : '내역이 없어요'}
            </p>
            {(filter !== 'all' || methodFilter !== 'all' || billingFilter !== 'all' || statementMonthFilter !== null || !!activeTag || !!search) && (
              <button
                onClick={() => {
                  setFilter('all')
                  setMethodFilter('all')
                  setBillingFilter('all')
                  setStatementMonthFilter(null)
                  setActiveTag(null)
                  setSearch('')
                }}
                className="mt-4 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] transition-colors"
              >
                필터 전체 초기화
              </button>
            )}
          </div>
        ) : (
          grouped.map(([date, list]) => {
            const dayBalance = getDayBalance(list)
            return (
              <div key={date} className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
                {/* 날짜 헤더 */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <span className="text-sm font-bold text-white">{formatDate(date)}</span>
                  <span className={`text-sm font-bold num ${dayBalance >= 0 ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                    {dayBalance >= 0 ? '+' : ''}{fmt(dayBalance)}원
                  </span>
                </div>

                <div>
                  {list.map((t, idx) => {
                    const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                    const tags = t.tags ?? []
                    return (
                      <div
                        key={t.id}
                        onClick={() => setDetailTransaction(t)}
                        className={`flex items-center gap-3 px-5 py-3.5 group cursor-pointer hover:bg-white/2 transition-colors ${idx < list.length - 1 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''
                          }`}
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: color.bg }}
                        >
                          {CATEGORY_EMOJI[t.category] ?? '📦'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-white leading-tight">{t.category}</p>
                          {t.description && (
                            <p className="text-xs text-[#4E5968] truncate mt-0.5">{t.description}</p>
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
                                  #{tag}
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
                              className="p-1.5 rounded-xl hover:bg-[#3D8EF8]/15 text-[#4E5968] hover:text-[#3D8EF8] transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(t.id) }}
                              aria-label={`${t.category} 내역 삭제`}
                              className="p-1.5 rounded-xl hover:bg-[#F25260]/15 text-[#4E5968] hover:text-[#F25260] transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

      </> /* end list view */}

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
