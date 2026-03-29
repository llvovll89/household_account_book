import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, BarChart2, StickyNote, FileDown } from 'lucide-react'
import type { Transaction, Memo, Budget, RecurringTransaction } from './types'
import { loadTransactions, saveTransactions, loadMemos, saveMemos, loadBudgets, saveBudgets, loadRecurring, saveRecurring } from './lib/storage'
import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionModal from './components/TransactionModal'
import MemoSection from './components/MemoSection'
import Analytics from './components/Analytics'
import ImportModal from './components/ImportModal'

type Tab = 'home' | 'transactions' | 'analytics' | 'memos'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
function getYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const TABS = [
  { id: 'home' as Tab,         label: '홈',   Icon: LayoutDashboard },
  { id: 'transactions' as Tab, label: '내역', Icon: List },
  { id: 'analytics' as Tab,    label: '분석', Icon: BarChart2 },
  { id: 'memos' as Tab,        label: '메모', Icon: StickyNote },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showImport, setShowImport] = useState(false)

  const yearMonth = getYearMonth(currentDate)

  useEffect(() => {
    setTransactions(loadTransactions())
    setMemos(loadMemos())
    setBudgets(loadBudgets())
    setRecurring(loadRecurring())
  }, [])

  // ── 거래 내역 ────────────────────────────────────────
  const handleSaveTransaction = useCallback(
    (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      setTransactions((prev) => {
        const next = editingTransaction
          ? prev.map((t) => t.id === editingTransaction.id ? { ...t, ...data } : t)
          : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
        saveTransactions(next)
        return next
      })
      setShowModal(false)
      setEditingTransaction(null)
    },
    [editingTransaction]
  )

  const handleDeleteTransaction = useCallback((id: string) => {
    if (!confirm('이 내역을 삭제할까요?')) return
    setTransactions((prev) => { const next = prev.filter((t) => t.id !== id); saveTransactions(next); return next })
  }, [])

  const handleBulkImport = useCallback((items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    setTransactions((prev) => {
      const next = [...prev, ...items.map((item) => ({ ...item, id: generateId(), createdAt: Date.now() }))]
      saveTransactions(next)
      return next
    })
  }, [])

  // ── 예산 ─────────────────────────────────────────────
  const handleBudgetsChange = useCallback((b: Budget[]) => {
    setBudgets(b); saveBudgets(b)
  }, [])

  // ── 정기 지출 ─────────────────────────────────────────
  const handleRecurringSave = useCallback((items: RecurringTransaction[]) => {
    setRecurring(items); saveRecurring(items)
  }, [])

  const handleApplyRecurring = useCallback((pending: RecurringTransaction[]) => {
    // 정기 항목을 이번 달 거래 내역으로 등록
    const newTx = pending.map((r) => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      date: `${yearMonth}-${String(r.dayOfMonth).padStart(2, '0')}`,
      createdAt: Date.now(),
    }))
    setTransactions((prev) => {
      const next = [...prev, ...newTx]
      saveTransactions(next)
      return next
    })
    // lastAppliedMonth 업데이트
    setRecurring((prev) => {
      const pendingIds = new Set(pending.map((r) => r.id))
      const next = prev.map((r) => pendingIds.has(r.id) ? { ...r, lastAppliedMonth: yearMonth } : r)
      saveRecurring(next)
      return next
    })
  }, [yearMonth])

  // ── 메모 ─────────────────────────────────────────────
  const handleAddMemo = useCallback((title: string, content: string) => {
    setMemos((prev) => {
      const now = Date.now()
      const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now }]
      saveMemos(next); return next
    })
  }, [])

  const handleUpdateMemo = useCallback((id: string, title: string, content: string) => {
    setMemos((prev) => { const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now() } : m); saveMemos(next); return next })
  }, [])

  const handleDeleteMemo = useCallback((id: string) => {
    if (!confirm('이 메모를 삭제할까요?')) return
    setMemos((prev) => { const next = prev.filter((m) => m.id !== id); saveMemos(next); return next })
  }, [])

  const handleTogglePin = useCallback((id: string) => {
    setMemos((prev) => { const next = prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m); saveMemos(next); return next })
  }, [])

  // ── 월 이동 ──────────────────────────────────────────
  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const isCurrentMonth = () => {
    const now = new Date()
    return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
  }

  // 헤더 월 요약
  const monthlyTx = transactions.filter((t) => t.date.startsWith(yearMonth))
  const monthIncome = monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const showFAB = tab === 'home' || tab === 'transactions'

  return (
    <div className="min-h-screen bg-[#0D0F14] pb-24">
      {/* ── 헤더 ── */}
      <header className="bg-[#0D0F14] sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-extrabold text-white tracking-tight">가계부</h1>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#3D8EF8] bg-[#3D8EF8]/10 hover:bg-[#3D8EF8]/20 transition-colors border border-[#3D8EF8]/15"
            >
              <FileDown size={13} />
              가져오기
            </button>
          </div>

          {/* 월 선택기 */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-full bg-[#1E2236] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-transform">
              <ChevronLeft size={16} className="text-[#8B95A1]" />
            </button>
            <button onClick={() => setCurrentDate(new Date())}
              className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${
                isCurrentMonth()
                  ? 'bg-white text-[#0D0F14]'
                  : 'bg-[#1E2236] text-[#8B95A1] border border-white/[0.06]'
              }`}>
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-full bg-[#1E2236] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-transform">
              <ChevronRight size={16} className="text-[#8B95A1]" />
            </button>
          </div>

          {/* 간략 요약 */}
          {(monthIncome > 0 || monthExpense > 0) && (
            <div className="flex items-center justify-center gap-4 mt-3 pb-1">
              <span className="text-xs font-semibold text-[#2ACF6A] num">+{monthIncome.toLocaleString()}</span>
              <div className="w-1 h-1 rounded-full bg-[#2D3352]" />
              <span className="text-xs font-semibold text-[#F25260] num">-{monthExpense.toLocaleString()}</span>
              <div className="w-1 h-1 rounded-full bg-[#2D3352]" />
              <span className={`text-xs font-bold num ${monthIncome - monthExpense >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                {(monthIncome - monthExpense).toLocaleString()}원
              </span>
            </div>
          )}
        </div>

        {/* 헤더 구분선 */}
        <div className="h-px bg-white/[0.04] mx-5" />
      </header>

      {/* ── 컨텐츠 ── */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === 'home' && (
          <Dashboard
            transactions={transactions}
            budgets={budgets}
            recurring={recurring}
            yearMonth={yearMonth}
            onBudgetsChange={handleBudgetsChange}
            onRecurringSave={handleRecurringSave}
            onApplyRecurring={handleApplyRecurring}
          />
        )}
        {tab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            yearMonth={yearMonth}
            onEdit={(t) => { setEditingTransaction(t); setShowModal(true) }}
            onDelete={handleDeleteTransaction}
          />
        )}
        {tab === 'analytics' && (
          <Analytics transactions={transactions} yearMonth={yearMonth} />
        )}
        {tab === 'memos' && (
          <MemoSection
            memos={memos}
            onAdd={handleAddMemo}
            onUpdate={handleUpdateMemo}
            onDelete={handleDeleteMemo}
            onTogglePin={handleTogglePin}
          />
        )}
      </main>

      {/* ── FAB ── */}
      {showFAB && (
        <button
          onClick={() => { setEditingTransaction(null); setShowModal(true) }}
          className="fixed right-5 bottom-[84px] w-14 h-14 bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-95 text-white rounded-full shadow-2xl shadow-[#3D8EF8]/30 flex items-center justify-center transition-all z-30"
        >
          <Plus size={26} />
        </button>
      )}

      {/* ── 하단 탭 ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto bg-[#0D0F14] border-t border-white/[0.06]">
          <div className="flex pb-safe">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center gap-1 pt-3 pb-4 transition-colors relative"
              >
                {tab === id && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#3D8EF8] rounded-full" />
                )}
                <Icon
                  size={21}
                  strokeWidth={tab === id ? 2.5 : 1.8}
                  className={tab === id ? 'text-[#3D8EF8]' : 'text-white/40'}
                />
                <span className={`text-[10px] font-bold ${tab === id ? 'text-[#3D8EF8]' : 'text-white/40'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── 모달 ── */}
      {showImport && (
        <ImportModal
          existingTransactions={transactions}
          onImport={handleBulkImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {showModal && (
        <TransactionModal
          transaction={editingTransaction}
          onSave={handleSaveTransaction}
          onClose={() => { setShowModal(false); setEditingTransaction(null) }}
        />
      )}
    </div>
  )
}
