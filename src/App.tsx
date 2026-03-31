import { useState, useEffect, useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, BarChart2, StickyNote, FileDown, RefreshCw, CheckCircle2, TrendingUp } from 'lucide-react'
import type { Memo, Budget, RecurringTransaction, TransactionType, Transaction, StockTrade } from './types'
import { loadMemos, saveMemos, loadBudgets, saveBudgets, loadRecurring, saveRecurring, loadSettings, saveSettings, saveTransactions } from './lib/storage'
import { generateId } from './lib/format'
import { useTransactions } from './hooks/useTransactions'
import { useStockTrades } from './hooks/useStockTrades'
import { usePWAInstall } from './hooks/usePWAInstall'
import StockTradeList from './components/StockTradeList'
import StockTradeModal from './components/StockTradeModal'
import CategoryModal from './components/CategoryModal'
import { registerToastHandler } from './lib/toast'
import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionModal from './components/TransactionModal'
import MemoSection from './components/MemoSection'
import Analytics from './components/Analytics'
import ImportModal from './components/ImportModal'
import HelpModal from './components/HelpModal'

type Tab = 'home' | 'transactions' | 'analytics' | 'memos' | 'stocks'

function getYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const TABS = [
  { id: 'home' as Tab, label: '홈', Icon: LayoutDashboard },
  { id: 'transactions' as Tab, label: '내역', Icon: List },
  { id: 'analytics' as Tab, label: '분석', Icon: BarChart2 },
  { id: 'memos' as Tab, label: '메모', Icon: StickyNote },
  { id: 'stocks' as Tab, label: '주식', Icon: TrendingUp },
]

export default function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() { updateServiceWorker(true) },
    onRegistered(r) { setInterval(() => r?.update(), 60 * 60 * 1000) },
  })

  // ── 커스텀 훅 ─────────────────────────────────────────
  const { transactions, setTransactions, saveTransaction, deleteTransaction, bulkImport } = useTransactions()
  const { stockTrades, saveStockTrade, deleteStockTrade } = useStockTrades()
  const { showInstallBanner, isIosManualInstall, installGuideText, deferredPrompt, closeInstallBanner, handleInstallClick } = usePWAInstall()

  // ── 기본 상태 ─────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('home')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [memos, setMemos] = useState<Memo[]>(() => loadMemos())
  const [budgets, setBudgets] = useState<Budget[]>(() => loadBudgets())
  const [recurring, setRecurring] = useState<RecurringTransaction[]>(() => loadRecurring())

  // ── 커스텀 카테고리 ───────────────────────────────────
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>(() => loadSettings().customExpenseCategories)
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>(() => loadSettings().customIncomeCategories)
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  // ── 모달 상태 ─────────────────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editingTrade, setEditingTrade] = useState<StockTrade | null>(null)

  // ── 토스트 ────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return registerToastHandler((msg, duration = 2500) => {
      setToastMsg(msg)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToastMsg(null), duration)
    })
  }, [])

  const yearMonth = getYearMonth(currentDate)

  // ── 거래 내역 핸들러 ──────────────────────────────────
  const handleSaveTransaction = useCallback(
    (data: Parameters<typeof saveTransaction>[0]) => {
      saveTransaction(data, editingTransaction)
      setShowModal(false)
      setEditingTransaction(null)
    },
    [editingTransaction, saveTransaction]
  )

  // ── 예산 ─────────────────────────────────────────────
  const handleBudgetsChange = useCallback((b: Budget[]) => {
    setBudgets(b); saveBudgets(b)
  }, [])

  // ── 정기 지출 ─────────────────────────────────────────
  const handleRecurringSave = useCallback((items: RecurringTransaction[]) => {
    setRecurring(items); saveRecurring(items)
  }, [])

  const handleApplyRecurring = useCallback((pending: RecurringTransaction[]) => {
    const newTx = pending.map((r) => ({
      id: generateId(),
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
    setRecurring((prev) => {
      const ids = new Set(pending.map((r) => r.id))
      const next = prev.map((r) => ids.has(r.id) ? { ...r, lastAppliedMonth: yearMonth } : r)
      saveRecurring(next)
      return next
    })
  }, [yearMonth])

  // ── 주식 거래 핸들러 ──────────────────────────────────
  const handleSaveStockTrade = useCallback(
    (data: Parameters<typeof saveStockTrade>[0]) => {
      saveStockTrade(data, editingTrade)
      setShowStockModal(false)
      setEditingTrade(null)
    },
    [editingTrade, saveStockTrade]
  )

  // ── 커스텀 카테고리 저장 ──────────────────────────────
  const handleSaveCategories = useCallback((expense: string[], income: string[]) => {
    setCustomExpenseCategories(expense)
    setCustomIncomeCategories(income)
    const current = loadSettings()
    saveSettings({ ...current, customExpenseCategories: expense, customIncomeCategories: income })
  }, [])

  // ── 메모 ─────────────────────────────────────────────
  const handleAddMemo = useCallback((title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string) => {
    setMemos((prev) => {
      const now = Date.now()
      const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now, date, amount, transactionType, category }]
      saveMemos(next); return next
    })
  }, [])

  const handleUpdateMemo = useCallback((id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string) => {
    setMemos((prev) => { const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now(), date, amount, transactionType, category } : m); saveMemos(next); return next })
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

  const monthlyTx = transactions.filter((t) => t.date.startsWith(yearMonth))
  const monthIncome = monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const showFAB = tab === 'home' || tab === 'transactions' || tab === 'stocks'

  return (
    <div className="min-h-screen bg-[#181818] pb-nav-safe">
      {/* SW 업데이트 토스트 */}
      {needRefresh && (
        <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div className="flex items-center gap-3 bg-[#252A3F] border border-[#3D8EF8]/30 rounded-2xl px-4 py-3.5 shadow-xl">
            <RefreshCw size={16} className="text-[#3D8EF8] shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
            <p className="text-sm font-semibold text-white flex-1">새 버전이 있어요!</p>
            <button onClick={() => updateServiceWorker(true)}
              className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors shrink-0">
              업데이트
            </button>
          </div>
        </div>
      )}

      {/* ── 헤더 ── */}
      <header className="bg-[#0D0F14] sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-extrabold text-white tracking-tight">가계부</h1>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#3D8EF8] bg-[#3D8EF8]/10 hover:bg-[#3D8EF8]/20 transition-colors border border-[#3D8EF8]/15">
              <FileDown size={13} />
              가져오기
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-full bg-[#1E2236] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-transform">
              <ChevronLeft size={16} className="text-[#8B95A1]" />
            </button>
            <button onClick={() => setCurrentDate(new Date())}
              className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isCurrentMonth() ? 'bg-white text-[#0D0F14]' : 'bg-[#1E2236] text-[#8B95A1] border border-white/[0.06]'}`}>
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-full bg-[#1E2236] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-transform">
              <ChevronRight size={16} className="text-[#8B95A1]" />
            </button>
          </div>

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
            customExpenseCategories={customExpenseCategories}
            onBudgetsChange={handleBudgetsChange}
            onRecurringSave={handleRecurringSave}
            onApplyRecurring={handleApplyRecurring}
            onOpenCategoryModal={() => setShowCategoryModal(true)}
          />
        )}
        {tab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            yearMonth={yearMonth}
            onEdit={(t) => { setEditingTransaction(t); setShowModal(true) }}
            onDelete={deleteTransaction}
          />
        )}
        {tab === 'analytics' && <Analytics transactions={transactions} yearMonth={yearMonth} />}
        {tab === 'memos' && (
          <MemoSection
            memos={memos}
            onAdd={handleAddMemo}
            onUpdate={handleUpdateMemo}
            onDelete={handleDeleteMemo}
            onTogglePin={handleTogglePin}
          />
        )}
        {tab === 'stocks' && (
          <StockTradeList
            trades={stockTrades}
            onEdit={(t) => { setEditingTrade(t); setShowStockModal(true) }}
            onDelete={deleteStockTrade}
          />
        )}
      </main>

      {/* ── FAB ── */}
      {showFAB && (
        <button
          onClick={() => {
            if (tab === 'stocks') { setEditingTrade(null); setShowStockModal(true) }
            else { setEditingTransaction(null); setShowModal(true) }
          }}
          aria-label="내역 추가"
          className="fixed right-5 bottom-fab-safe w-8 h-8 bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-95 text-white rounded-full shadow-2xl shadow-[#3D8EF8]/30 flex items-center justify-center transition-all z-30"
        >
          <Plus size={20} />
        </button>
      )}

      <button onClick={() => setShowHelp(true)} aria-label="사용 가이드"
        className="fixed left-5 bottom-fab-safe w-8 h-8 bg-[#1E2236] border border-white/10 hover:bg-[#252A3F] active:scale-95 text-[#4E5968] hover:text-[#8B95A1] rounded-full flex items-center justify-center transition-all z-30 text-sm font-bold">
        ?
      </button>

      {/* ── 설치 배너 ── */}
      {showInstallBanner && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-banner-safe z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div className="bg-[#252A3F] border border-[#3D8EF8]/25 rounded-2xl px-4 py-3.5 shadow-xl">
            <p className="text-sm font-semibold text-white">앱처럼 빠르게 사용하려면 홈 화면에 추가하세요.</p>
            <p className="text-[11px] text-[#8B95A1] mt-1">
              {isIosManualInstall ? installGuideText : '설치 버튼을 눌러 가계부 앱을 설치할 수 있어요.'}
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={closeInstallBanner}
                className="px-3 py-1.5 rounded-xl bg-[#1E2236] text-[#8B95A1] text-xs font-bold">닫기</button>
              {!isIosManualInstall && deferredPrompt && (
                <button onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors">설치</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 하단 탭 ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto bg-[#0D0F14] border-t border-white/6">
          <div className="flex pb-safe">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center gap-1 pt-3 pb-4 transition-colors relative">
                {tab === id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#3D8EF8] rounded-full" />}
                <Icon size={21} strokeWidth={tab === id ? 2.5 : 1.8} className={tab === id ? 'text-[#3D8EF8]' : 'text-white/40'} />
                <span className={`text-[10px] font-bold ${tab === id ? 'text-[#3D8EF8]' : 'text-white/40'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── 토스트 ── */}
      {toastMsg && (
        <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm pointer-events-none">
          <div className="flex items-center gap-3 bg-[#252A3F] border border-white/10 rounded-2xl px-4 py-3 shadow-xl">
            <CheckCircle2 size={16} className="text-[#2ACF6A] shrink-0" />
            <p className="text-sm font-semibold text-white">{toastMsg}</p>
          </div>
        </div>
      )}

      {/* ── 모달 ── */}
      {showStockModal && (
        <StockTradeModal
          trade={editingTrade}
          onSave={handleSaveStockTrade}
          onClose={() => { setShowStockModal(false); setEditingTrade(null) }}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showImport && (
        <ImportModal
          existingTransactions={transactions}
          onImport={bulkImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {showModal && (
        <TransactionModal
          transaction={editingTransaction}
          onSave={handleSaveTransaction}
          onClose={() => { setShowModal(false); setEditingTransaction(null) }}
          customExpenseCategories={customExpenseCategories}
          customIncomeCategories={customIncomeCategories}
        />
      )}
      {showCategoryModal && (
        <CategoryModal
          customExpenseCategories={customExpenseCategories}
          customIncomeCategories={customIncomeCategories}
          onSave={handleSaveCategories}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  )
}
