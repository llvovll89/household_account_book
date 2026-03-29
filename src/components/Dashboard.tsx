import { useMemo, useState, useEffect } from 'react'
import { Settings2, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, PlusCircle, Pencil } from 'lucide-react'
import type { Transaction, Budget, RecurringTransaction } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../types'
import BudgetModal from './BudgetModal'
import RecurringModal from './RecurringModal'
import { loadSettings, saveSettings } from '../lib/storage'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  yearMonth: string
  onBudgetsChange: (b: Budget[]) => void
  onRecurringSave: (items: RecurringTransaction[]) => void
  onApplyRecurring: (items: RecurringTransaction[]) => void
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR')
}

export default function Dashboard({ transactions, budgets, recurring, yearMonth, onBudgetsChange, onRecurringSave, onApplyRecurring }: Props) {
  const [showBudget, setShowBudget] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [payday, setPayday] = useState<number | null>(null)
  const [editingPayday, setEditingPayday] = useState(false)
  const [paydayInput, setPaydayInput] = useState('')

  useEffect(() => {
    const settings = loadSettings()
    setPayday(settings.payday)
  }, [])

  function handleSavePayday() {
    const val = parseInt(paydayInput)
    if (!val || val < 1 || val > 31) return
    setPayday(val)
    saveSettings({ payday: val })
    setEditingPayday(false)
  }

  // 월급날까지 남은 일수 + 하루 가용 예산 계산
  const paydayInfo = useMemo(() => {
    if (!payday) return null
    const today = new Date()
    const todayNum = today.getDate()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    let daysLeft: number
    if (payday > todayNum) {
      // 이번 달 아직 안 됨
      daysLeft = payday - todayNum
    } else if (payday === todayNum) {
      daysLeft = 0
    } else {
      // 다음 달 월급날
      const nextPayday = new Date(currentYear, currentMonth + 1, payday)
      daysLeft = Math.round((nextPayday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }

    // 이번 달 남은 예산 = 수입 - 지출
    const [y, m] = yearMonth.split('-').map(Number)
    const monthlyTx = transactions.filter((t) => t.date.startsWith(yearMonth))
    const income = monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const remaining = income - expense

    // 이번 달 남은 날수
    const daysInMonth = new Date(y, m, 0).getDate()
    const daysRemaining = Math.max(1, daysInMonth - todayNum + 1)
    const dailyBudget = remaining > 0 ? Math.floor(remaining / daysRemaining) : 0

    return { daysLeft, remaining, dailyBudget }
  }, [payday, transactions, yearMonth])

  const monthly = useMemo(
    () => transactions.filter((t) => t.date.startsWith(yearMonth)),
    [transactions, yearMonth]
  )
  const income = useMemo(
    () => monthly.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthly]
  )
  const expense = useMemo(
    () => monthly.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthly]
  )
  const balance = income - expense
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    monthly.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [monthly])

  // 이번 달 미적용 정기 항목
  const pendingRecurring = useMemo(
    () => recurring.filter((r) => r.lastAppliedMonth !== yearMonth),
    [recurring, yearMonth]
  )

  // 예산 초과 카테고리
  const overBudget = useMemo(() => {
    const map: Record<string, number> = {}
    monthly.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return budgets.filter((b) => (map[b.category] || 0) > b.limit)
  }, [monthly, budgets])

  return (
    <div className="space-y-3 tab-content">
      {/* 예산 초과 알림 */}
      {overBudget.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#F5BE3A]/10 rounded-2xl border border-[#F5BE3A]/20">
          <AlertTriangle size={16} className="text-[#F5BE3A] shrink-0" />
          <p className="text-sm text-[#F5BE3A] font-semibold">
            {overBudget.map(b => b.category).join(', ')} 예산을 초과했어요
          </p>
        </div>
      )}

      {/* 정기 지출 미적용 알림 */}
      {pendingRecurring.length > 0 && (
        <div className="bg-[#1E2236] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-[#3D8EF8]" />
              <span className="text-sm font-bold text-white">이번 달 정기 항목</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">
                {pendingRecurring.length}건 미등록
              </span>
            </div>
            <button
              onClick={() => setShowRecurring(true)}
              className="text-xs text-[#4E5968] hover:text-[#8B95A1] font-semibold transition-colors"
            >
              관리
            </button>
          </div>
          <div className="space-y-2 mb-3">
            {pendingRecurring.slice(0, 3).map((r) => {
              const color = CATEGORY_COLOR[r.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              return (
                <div key={r.id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: color.bg }}>
                    {CATEGORY_EMOJI[r.category] ?? '📦'}
                  </div>
                  <span className="text-sm text-[#8B95A1] flex-1">{r.category}</span>
                  <span className="text-xs text-[#4E5968]">매월 {r.dayOfMonth}일</span>
                  <span className={`text-sm font-bold num ${r.type === 'income' ? 'text-[#2ACF6A]' : 'text-[#F1F3F6]'}`}>
                    {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()}원
                  </span>
                </div>
              )
            })}
            {pendingRecurring.length > 3 && (
              <p className="text-xs text-[#4E5968] text-center pt-1">외 {pendingRecurring.length - 3}건 더</p>
            )}
          </div>
          <button
            onClick={() => onApplyRecurring(pendingRecurring)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3D8EF8]/15 text-[#3D8EF8] text-sm font-bold hover:bg-[#3D8EF8]/25 transition-colors"
          >
            <PlusCircle size={14} />
            {pendingRecurring.length}건 이번 달에 등록
          </button>
        </div>
      )}

      {/* 메인 잔액 카드 */}
      <div className="rounded-3xl p-6 bg-gradient-to-br from-[#1E2A4A] to-[#162040] border border-[#3D8EF8]/20">
        <p className="text-sm font-medium text-[#8B95A1] mb-1">이번 달 잔액</p>
        <p className={`text-[38px] font-extrabold leading-tight num tracking-tight ${balance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
          {balance < 0 ? '-' : ''}{fmt(Math.abs(balance))}
          <span className="text-[20px] font-bold ml-1 text-[#8B95A1]">원</span>
        </p>

        <div className="mt-5 pt-4 border-t border-white/[0.07] grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#2ACF6A]/15 flex items-center justify-center">
              <TrendingUp size={14} className="text-[#2ACF6A]" />
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1]">수입</p>
              <p className="text-sm font-bold text-[#2ACF6A] num">+{fmt(income)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#F25260]/15 flex items-center justify-center">
              <TrendingDown size={14} className="text-[#F25260]" />
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1]">지출</p>
              <p className="text-sm font-bold text-[#F25260] num">-{fmt(expense)}</p>
            </div>
          </div>
        </div>

        {income > 0 && (
          <div className="mt-4">
            <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((expense / income) * 100, 100)}%`,
                  background: expense / income > 0.9 ? '#F25260' : expense / income > 0.7 ? '#F5BE3A' : '#3D8EF8',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-[#4E5968]">
              <span>지출 {income > 0 ? Math.round((expense / income) * 100) : 0}%</span>
              {savingsRate !== null && <span>저축률 {savingsRate}%</span>}
            </div>
          </div>
        )}
      </div>

      {/* 월급날 카운트다운 */}
      {!payday && !editingPayday && (
        <button
          onClick={() => { setEditingPayday(true); setPaydayInput('') }}
          className="w-full flex items-center gap-2 justify-center py-3 rounded-2xl border border-dashed border-white/10 text-xs font-semibold text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
        >
          💰 월급날 설정하기
        </button>
      )}

      {editingPayday && (
        <div className="bg-[#1E2236] rounded-2xl px-4 py-3.5 flex items-center gap-3">
          <span className="text-sm font-semibold text-white shrink-0">매월</span>
          <input
            type="number" min="1" max="31"
            value={paydayInput}
            onChange={(e) => setPaydayInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePayday()}
            placeholder="15"
            autoFocus
            className="flex-1 bg-[#252A3F] text-white text-center font-bold rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
          />
          <span className="text-sm font-semibold text-white shrink-0">일이 월급날</span>
          <button onClick={handleSavePayday}
            className="px-3 py-2 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors shrink-0">
            저장
          </button>
          <button onClick={() => setEditingPayday(false)}
            className="px-3 py-2 rounded-xl bg-[#252A3F] text-[#8B95A1] text-xs font-bold transition-colors shrink-0">
            취소
          </button>
        </div>
      )}

      {payday && !editingPayday && paydayInfo && (
        <div className="bg-[#1E2236] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span className="text-sm font-bold text-white">
                {paydayInfo.daysLeft === 0
                  ? '오늘이 월급날이에요! 🎉'
                  : `월급까지 D-${paydayInfo.daysLeft}`}
              </span>
            </div>
            <button
              onClick={() => { setEditingPayday(true); setPaydayInput(String(payday)) }}
              className="p-1.5 rounded-lg text-[#4E5968] hover:text-[#8B95A1] transition-colors"
            >
              <Pencil size={12} />
            </button>
          </div>
          {paydayInfo.remaining > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-px flex-1 bg-white/[0.05]" />
              <span className="text-xs text-[#4E5968]">오늘 쓸 수 있는 금액</span>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>
          )}
          {paydayInfo.dailyBudget > 0 ? (
            <p className="text-center text-[22px] font-extrabold text-[#3D8EF8] num mt-1.5">
              {paydayInfo.dailyBudget.toLocaleString()}
              <span className="text-sm font-semibold text-[#4E5968] ml-1">원</span>
            </p>
          ) : paydayInfo.remaining <= 0 ? (
            <p className="text-center text-sm font-semibold text-[#F25260] mt-1.5">이번 달 예산을 초과했어요</p>
          ) : null}
        </div>
      )}

      {/* 예산 관리 카드 */}
      <div className="bg-[#1E2236] rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-bold text-white">예산 관리</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRecurring(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#252A3F] text-[#8B95A1] hover:text-white hover:bg-[#2D3352] text-xs font-semibold transition-colors"
            >
              <RefreshCw size={11} />
              정기
            </button>
          <button
            onClick={() => setShowBudget(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#252A3F] text-[#8B95A1] hover:text-white hover:bg-[#2D3352] text-xs font-semibold transition-colors"
          >
            <Settings2 size={12} />
            설정
          </button>
          </div>
        </div>

        {budgets.length === 0 ? (
          <button
            onClick={() => setShowBudget(true)}
            className="w-full py-4 rounded-2xl border border-dashed border-white/10 text-sm text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
          >
            + 카테고리별 예산을 설정해보세요
          </button>
        ) : (
          <div className="space-y-3.5">
            {EXPENSE_CATEGORIES.filter(cat => budgets.find(b => b.category === cat)).map((cat) => {
              const budget = budgets.find((b) => b.category === cat)!
              const spent = monthly
                .filter((t) => t.type === 'expense' && t.category === cat)
                .reduce((s, t) => s + t.amount, 0)
              const pct = Math.min((spent / budget.limit) * 100, 100)
              const isOver = spent > budget.limit
              const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                      <span className="text-sm font-semibold text-white">{cat}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold num ${isOver ? 'text-[#F25260]' : 'text-white'}`}>
                        {fmt(spent)}
                      </span>
                      <span className="text-xs text-[#4E5968] num"> / {fmt(budget.limit)}원</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#252A3F] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isOver ? '#F25260' : color.text,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 카테고리별 지출 */}
      {expenseByCategory.length > 0 && (
        <div className="bg-[#1E2236] rounded-3xl p-5">
          <p className="text-[15px] font-bold text-white mb-4">이번 달 지출 TOP</p>
          <div className="space-y-3">
            {expenseByCategory.map(([cat, amt]) => {
              const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: color.bg }}
                  >
                    {CATEGORY_EMOJI[cat] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-semibold text-white">{cat}</span>
                      <span className="text-sm font-bold text-white num">{fmt(amt)}원</span>
                    </div>
                    <div className="h-1 bg-[#252A3F] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color.text }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-[#4E5968] w-7 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {monthly.length === 0 && (
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">💸</p>
          <p className="font-bold text-white text-[15px]">내역이 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">+ 버튼으로 첫 내역을 추가해보세요</p>
        </div>
      )}

      {showBudget && (
        <BudgetModal
          budgets={budgets}
          onSave={onBudgetsChange}
          onClose={() => setShowBudget(false)}
        />
      )}
      {showRecurring && (
        <RecurringModal
          recurring={recurring}
          onSave={onRecurringSave}
          onClose={() => setShowRecurring(false)}
        />
      )}
    </div>
  )
}
