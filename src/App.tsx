import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, BarChart2, StickyNote, FileDown, RefreshCw, CheckCircle2, LogOut, TrendingUp } from 'lucide-react'
import type { Transaction, Memo, Budget, RecurringTransaction, TransactionType, StockTrade } from './types'
import { loadAllData, loadSettings, saveBudgets, saveMemos, saveRecurring, saveSettings, saveStockTrades, saveTransactions } from './lib/storage'
import { generateId } from './lib/format'
import { usePWAInstall } from './hooks/usePWAInstall'
import { useAuthSync } from './hooks/useAuthSync'
import { registerToastHandler, showToast } from './lib/toast'
import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionModal from './components/TransactionModal'
import MemoSection from './components/MemoSection'
import Analytics from './components/Analytics'
import ImportModal from './components/ImportModal'
import HelpModal from './components/HelpModal'
import StockTradeList from './components/StockTradeList'
import StockTradeModal from './components/StockTradeModal'
import CategoryModal from './components/CategoryModal'

type Tab = 'home' | 'transactions' | 'analytics' | 'memos' | 'stocks'

const DATA_LOAD_TIMEOUT_MS = 9000

function getYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function calcNet(items: Transaction[]) {
  return items.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
}

const TABS = [
  { id: 'home' as Tab, label: '홈', Icon: LayoutDashboard },
  { id: 'transactions' as Tab, label: '내역', Icon: List },
  { id: 'analytics' as Tab, label: '분석', Icon: BarChart2 },
  { id: 'memos' as Tab, label: '메모', Icon: StickyNote },
  { id: 'stocks' as Tab, label: '주식', Icon: TrendingUp },
]

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4C12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.2 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.4 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.2-5.9 6.8l6.2 5.2C39.3 36.6 44 31 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() { updateServiceWorker(true) },
    onRegistered(r) { setInterval(() => r?.update(), 60 * 60 * 1000) },
  })

  const { showInstallBanner, isIosManualInstall, installGuideText, deferredPrompt, closeInstallBanner, handleInstallClick } = usePWAInstall()

  const [tab, setTab] = useState<Tab>('home')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])

  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([])
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editingTrade, setEditingTrade] = useState<StockTrade | null>(null)
  const [memoAddTrigger, setMemoAddTrigger] = useState(0)

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
  const hydrateData = useCallback(async () => {
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('data-load-timeout')), DATA_LOAD_TIMEOUT_MS)
    })

    const snapshot = await Promise.race([loadAllData(), timeout])
    setTransactions(snapshot.transactions)
    setMemos(snapshot.memos)
    setBudgets(snapshot.budgets)
    setRecurring(snapshot.recurring)
    setStockTrades(snapshot.stockTrades)
    setCustomExpenseCategories(snapshot.settings.customExpenseCategories)
    setCustomIncomeCategories(snapshot.settings.customIncomeCategories)
  }, [])

  const {
    user,
    authReady,
    isSyncing,
    settingsVersion,
    showAuthModal,
    authMode,
    email,
    password,
    authBusy,
    setShowAuthModal,
    setAuthMode,
    setEmail,
    setPassword,
    handleGoogleLogin,
    handleEmailAuth,
    handleLogout,
  } = useAuthSync({ hydrateData })

  const visibleTabs = useMemo(() => {
    if (user) return TABS
    return TABS.filter((t) => t.id !== 'stocks')
  }, [user])
  const activeTab: Tab = !user && tab === 'stocks' ? 'home' : tab

  const persist = useCallback((task: Promise<void>, failMsg: string) => {
    void task.catch(() => showToast(failMsg))
  }, [])

  const handleSaveTransaction = useCallback(
    (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      setTransactions((prev) => {
        const next = editingTransaction
          ? prev.map((t) => t.id === editingTransaction.id ? { ...t, ...data } : t)
          : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
        persist(saveTransactions(next), '거래 저장에 실패했습니다.')
        return next
      })
      setShowModal(false)
      setEditingTransaction(null)
    },
    [editingTransaction, persist]
  )

  const handleDeleteTransaction = useCallback((id: string) => {
    if (!confirm('이 내역을 삭제할까요?')) return
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== id)
      persist(saveTransactions(next), '거래 삭제 저장에 실패했습니다.')
      return next
    })
  }, [persist])

  const handleBulkImport = useCallback((items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    setTransactions((prev) => {
      const next = [...prev, ...items.map((item) => ({ ...item, id: generateId(), createdAt: Date.now() }))]
      persist(saveTransactions(next), '가져오기 저장에 실패했습니다.')
      return next
    })
  }, [persist])

  const handleSaveStockTrade = useCallback((data: Omit<StockTrade, 'id' | 'createdAt'>) => {
    setStockTrades((prev) => {
      const next = editingTrade
        ? prev.map((t) => t.id === editingTrade.id ? { ...t, ...data } : t)
        : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
      persist(saveStockTrades(next), '주식 거래 저장에 실패했습니다.')
      return next
    })
    setShowStockModal(false)
    setEditingTrade(null)
  }, [editingTrade, persist])

  const handleDeleteStockTrade = useCallback((id: string) => {
    if (!confirm('이 거래를 삭제할까요?')) return
    setStockTrades((prev) => {
      const next = prev.filter((t) => t.id !== id)
      persist(saveStockTrades(next), '주식 거래 삭제에 실패했습니다.')
      return next
    })
  }, [persist])

  const handleBudgetsChange = useCallback((b: Budget[]) => {
    setBudgets(b)
    persist(saveBudgets(b), '예산 저장에 실패했습니다.')
  }, [persist])

  const handleRecurringSave = useCallback((items: RecurringTransaction[]) => {
    setRecurring(items)
    persist(saveRecurring(items), '정기내역 저장에 실패했습니다.')
  }, [persist])

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
      persist(saveTransactions(next), '정기내역 적용 저장에 실패했습니다.')
      return next
    })
    setRecurring((prev) => {
      const ids = new Set(pending.map((r) => r.id))
      const next = prev.map((r) => ids.has(r.id) ? { ...r, lastAppliedMonth: yearMonth } : r)
      persist(saveRecurring(next), '정기내역 상태 저장에 실패했습니다.')
      return next
    })
  }, [persist, yearMonth])

  const handleSaveCategories = useCallback((expense: string[], income: string[]) => {
    setCustomExpenseCategories(expense)
    setCustomIncomeCategories(income)
    persist(
      (async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, customExpenseCategories: expense, customIncomeCategories: income })
      })(),
      '카테고리 저장에 실패했습니다.'
    )
  }, [persist])

  const handleAddMemo = useCallback((title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string) => {
    setMemos((prev) => {
      const now = Date.now()
      const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now, date, amount, transactionType, category }]
      persist(saveMemos(next), '메모 저장에 실패했습니다.')
      return next
    })
  }, [persist])

  const handleUpdateMemo = useCallback((id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now(), date, amount, transactionType, category } : m)
      persist(saveMemos(next), '메모 수정 저장에 실패했습니다.')
      return next
    })
  }, [persist])

  const handleDeleteMemo = useCallback((id: string) => {
    if (!confirm('이 메모를 삭제할까요?')) return
    setMemos((prev) => {
      const next = prev.filter((m) => m.id !== id)
      persist(saveMemos(next), '메모 삭제 저장에 실패했습니다.')
      return next
    })
  }, [persist])

  const handleTogglePin = useCallback((id: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m)
      persist(saveMemos(next), '메모 고정 상태 저장에 실패했습니다.')
      return next
    })
  }, [persist])

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const isCurrentMonth = () => {
    const now = new Date()
    return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
  }

  const monthlyTx = transactions.filter((t) => t.date.startsWith(yearMonth))
  const openingBalance = calcNet(transactions.filter((t) => t.date < `${yearMonth}-01`))
  const monthIncome = monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthBalance = openingBalance + (monthIncome - monthExpense)

  const showFAB = activeTab === 'home' || activeTab === 'transactions' || activeTab === 'memos' || activeTab === 'stocks'

  if (!authReady || isSyncing) {
    return (
      <div className="min-h-screen bg-[#181818] flex items-center justify-center px-6">
        <p className="text-sm text-[#8B95A1] font-semibold">데이터를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#181818] pb-nav-safe">
      {needRefresh && (
        <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div className="flex items-center gap-3 bg-[#252A3F] border border-[#3D8EF8]/30 rounded-2xl px-4 py-3.5 shadow-xl">
            <RefreshCw size={16} className="text-[#3D8EF8] shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
            <p className="text-sm font-semibold text-white flex-1">새 버전이 있어요!</p>
            <button onClick={() => updateServiceWorker(true)} className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors shrink-0">
              업데이트
            </button>
          </div>
        </div>
      )}

      <header className="bg-[#0D0F14] sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-extrabold text-white tracking-tight">가계부</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#3D8EF8] bg-[#3D8EF8]/10 hover:bg-[#3D8EF8]/20 transition-colors border border-[#3D8EF8]/15">
                <FileDown size={13} />
                가져오기
              </button>
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl bg-[#1E2236] border border-white/10 max-w-37.5">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="profile" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#3D8EF8]/25 text-[#79B2FF] text-[10px] font-bold flex items-center justify-center">
                        {(user.email?.[0] ?? 'U').toUpperCase()}
                      </div>
                    )}
                    <span className="text-[11px] text-[#C8D1DC] truncate">{user.email?.split('@')[0] ?? '로그인 사용자'}</span>
                  </div>
                  <button onClick={handleLogout} aria-label="로그아웃" title="로그아웃" className="w-8 h-8 rounded-xl text-[#F5BE3A] bg-[#F5BE3A]/10 hover:bg-[#F5BE3A]/20 transition-colors border border-[#F5BE3A]/15 flex items-center justify-center">
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#2ACF6A] bg-[#2ACF6A]/10 hover:bg-[#2ACF6A]/20 transition-colors border border-[#2ACF6A]/15">
                  로그인
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-[#1E2236] border border-white/6 flex items-center justify-center active:scale-95 transition-transform">
              <ChevronLeft size={16} className="text-[#8B95A1]" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isCurrentMonth() ? 'bg-white text-[#0D0F14]' : 'bg-[#1E2236] text-[#8B95A1] border border-white/6'}`}>
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </button>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-[#1E2236] border border-white/6 flex items-center justify-center active:scale-95 transition-transform">
              <ChevronRight size={16} className="text-[#8B95A1]" />
            </button>
          </div>

          {(monthIncome > 0 || monthExpense > 0) && (
            <div className="flex items-center justify-center gap-4 mt-3 pb-1">
              <span className="text-xs font-semibold text-[#2ACF6A] num">+{monthIncome.toLocaleString()}</span>
              <div className="w-1 h-1 rounded-full bg-[#2D3352]" />
              <span className="text-xs font-semibold text-[#F25260] num">-{monthExpense.toLocaleString()}</span>
              <div className="w-1 h-1 rounded-full bg-[#2D3352]" />
              <span className={`text-xs font-bold num ${monthBalance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                {monthBalance.toLocaleString()}원
              </span>
            </div>
          )}
        </div>
        <div className="h-px bg-white/4 mx-5" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {activeTab === 'home' && (
          <Dashboard
            transactions={transactions}
            budgets={budgets}
            recurring={recurring}
            settingsVersion={settingsVersion}
            yearMonth={yearMonth}
            customExpenseCategories={customExpenseCategories}
            onBudgetsChange={handleBudgetsChange}
            onRecurringSave={handleRecurringSave}
            onApplyRecurring={handleApplyRecurring}
            onOpenCategoryModal={() => setShowCategoryModal(true)}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            yearMonth={yearMonth}
            onEdit={(t) => { setEditingTransaction(t); setShowModal(true) }}
            onDelete={handleDeleteTransaction}
          />
        )}
        {activeTab === 'analytics' && <Analytics transactions={transactions} yearMonth={yearMonth} />}
        {activeTab === 'memos' && (
          <MemoSection
            memos={memos}
            onAdd={handleAddMemo}
            onUpdate={handleUpdateMemo}
            onDelete={handleDeleteMemo}
            onTogglePin={handleTogglePin}
            externalAddTrigger={memoAddTrigger}
          />
        )}
        {activeTab === 'stocks' && (
          <StockTradeList
            trades={stockTrades}
            onEdit={(t) => { setEditingTrade(t); setShowStockModal(true) }}
            onDelete={handleDeleteStockTrade}
          />
        )}
      </main>

      {showFAB && (
        <button
          onClick={() => {
            if (activeTab === 'stocks') {
              setEditingTrade(null)
              setShowStockModal(true)
            } else if (activeTab === 'memos') {
              setMemoAddTrigger((prev) => prev + 1)
            } else {
              setEditingTransaction(null)
              setShowModal(true)
            }
          }}
          aria-label="내역 추가"
          className="fixed right-5 bottom-fab-safe w-8 h-8 bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-95 text-white rounded-full shadow-2xl shadow-[#3D8EF8]/30 flex items-center justify-center transition-all z-30"
        >
          <Plus size={20} />
        </button>
      )}

      <button onClick={() => setShowHelp(true)} aria-label="사용 가이드" className="fixed left-5 bottom-fab-safe w-8 h-8 bg-[#1E2236] border border-white/10 hover:bg-[#252A3F] active:scale-95 text-[#4E5968] hover:text-[#8B95A1] rounded-full flex items-center justify-center transition-all z-30 text-sm font-bold">
        ?
      </button>

      {showInstallBanner && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-banner-safe z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div className="bg-[#252A3F] border border-[#3D8EF8]/25 rounded-2xl px-4 py-3.5 shadow-xl">
            <p className="text-sm font-semibold text-white">앱처럼 빠르게 사용하려면 홈 화면에 추가하세요.</p>
            <p className="text-[11px] text-[#8B95A1] mt-1">
              {isIosManualInstall ? installGuideText : '설치 버튼을 눌러 가계부 앱을 설치할 수 있어요.'}
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={closeInstallBanner} className="px-3 py-1.5 rounded-xl bg-[#1E2236] text-[#8B95A1] text-xs font-bold">닫기</button>
              {!isIosManualInstall && deferredPrompt && (
                <button onClick={handleInstallClick} className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors">설치</button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto bg-[#0D0F14] border-t border-white/6">
          <div className="flex pb-safe">
            {visibleTabs.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)} className="flex-1 flex flex-col items-center gap-1 pt-3 pb-4 transition-colors relative">
                {activeTab === id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#3D8EF8] rounded-full" />}
                <Icon size={21} strokeWidth={activeTab === id ? 2.5 : 1.8} className={activeTab === id ? 'text-[#3D8EF8]' : 'text-white/40'} />
                <span className={`text-[10px] font-bold ${activeTab === id ? 'text-[#3D8EF8]' : 'text-white/40'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {toastMsg && (
        <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm pointer-events-none">
          <div className="flex items-center gap-3 bg-[#252A3F] border border-white/10 rounded-2xl px-4 py-3 shadow-xl">
            <CheckCircle2 size={16} className="text-[#2ACF6A] shrink-0" />
            <p className="text-sm font-semibold text-white">{toastMsg}</p>
          </div>
        </div>
      )}

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
          onImport={handleBulkImport}
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

      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-base font-bold">계정 로그인</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-xs font-bold text-[#8B95A1]">닫기</button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${authMode === 'login' ? 'bg-[#3D8EF8] text-white' : 'bg-[#1E2236] text-[#8B95A1]'}`}
              >
                이메일 로그인
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${authMode === 'signup' ? 'bg-[#3D8EF8] text-white' : 'bg-[#1E2236] text-[#8B95A1]'}`}
              >
                회원가입
              </button>
            </div>

            <div className="space-y-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full px-3 py-2 rounded-xl bg-[#1E2236] border border-white/10 text-sm text-white placeholder:text-[#8B95A1] outline-none focus:border-[#3D8EF8]" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 (6자 이상)" className="w-full px-3 py-2 rounded-xl bg-[#1E2236] border border-white/10 text-sm text-white placeholder:text-[#8B95A1] outline-none focus:border-[#3D8EF8]" />
            </div>

            <button onClick={handleEmailAuth} disabled={authBusy} className="w-full py-2.5 rounded-xl bg-[#3D8EF8] disabled:opacity-50 text-white text-sm font-bold">
              {authBusy ? '처리 중...' : authMode === 'signup' ? '이메일 회원가입' : '이메일 로그인'}
            </button>

            <button onClick={handleGoogleLogin} className="w-full py-2.5 rounded-xl bg-[#09f]/80 text-white text-sm font-bold flex items-center justify-center gap-2">
              <GoogleIcon />
              구글 로그인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
