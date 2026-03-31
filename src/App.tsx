import { useState, useEffect, useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, BarChart2, StickyNote, FileDown, RefreshCw, CheckCircle2 } from 'lucide-react'
import type { Transaction, Memo, Budget, RecurringTransaction, TransactionType } from './types'
import { loadTransactions, saveTransactions, loadMemos, saveMemos, loadBudgets, saveBudgets, loadRecurring, saveRecurring } from './lib/storage'
import { registerToastHandler } from './lib/toast'
import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionModal from './components/TransactionModal'
import MemoSection from './components/MemoSection'
import Analytics from './components/Analytics'
import ImportModal from './components/ImportModal'
import HelpModal from './components/HelpModal'

type Tab = 'home' | 'transactions' | 'analytics' | 'memos'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const PWA_PROMPT_DISMISSED_KEY = 'pwa-install-prompt-dismissed'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
function getYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const TABS = [
  { id: 'home' as Tab, label: '홈', Icon: LayoutDashboard },
  { id: 'transactions' as Tab, label: '내역', Icon: List },
  { id: 'analytics' as Tab, label: '분석', Icon: BarChart2 },
  { id: 'memos' as Tab, label: '메모', Icon: StickyNote },
]

export default function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      updateServiceWorker(true)
    },
    onRegistered(r) {
      // 1시간마다 SW 업데이트 체크
      setInterval(() => r?.update(), 60 * 60 * 1000)
    },
  })

  const [tab, setTab] = useState<Tab>('home')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIosManualInstall, setIsIosManualInstall] = useState(false)
  const [installGuideText, setInstallGuideText] = useState('설치 버튼을 눌러 가계부 앱을 설치할 수 있어요.')
  const hasInstallPromptRef = useRef(false)
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

  useEffect(() => {
    setTransactions(loadTransactions())
    setMemos(loadMemos())
    setBudgets(loadBudgets())
    setRecurring(loadRecurring())
  }, [])

  useEffect(() => {
    const dismissed = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY) === '1'
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (dismissed || isStandalone) return

    const ua = window.navigator.userAgent.toLowerCase()
    const isMobile = /android|iphone|ipad|ipod/.test(ua)
    const isIos = /iphone|ipad|ipod/.test(ua)
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua)
    const isIosChrome = /crios/.test(ua)
    const isIosEdge = /edgios/.test(ua)
    const isIosFirefox = /fxios/.test(ua)

    if (!isMobile) return

    if (isIos) {
      const iosGuideText = isSafari
        ? 'Safari 하단 공유 버튼 → 홈 화면에 추가'
        : isIosChrome
          ? 'Chrome 메뉴(⋯) → 홈 화면에 추가'
          : isIosEdge
            ? 'Edge 메뉴(⋯) → 휴대폰에 추가(홈 화면)'
            : isIosFirefox
              ? 'Firefox 메뉴(☰) → 홈 화면에 추가'
              : '브라우저 메뉴에서 홈 화면에 추가를 선택하세요.'

      setIsIosManualInstall(true)
      setInstallGuideText(iosGuideText)
      setShowInstallBanner(true)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      hasInstallPromptRef.current = true
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setIsIosManualInstall(false)
      setInstallGuideText('설치 버튼을 눌러 가계부 앱을 설치할 수 있어요.')
      setShowInstallBanner(true)
    }

    const onInstalled = () => {
      setShowInstallBanner(false)
      setDeferredPrompt(null)
      localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, '1')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    const fallbackTimer = window.setTimeout(() => {
      if (!isIos && !hasInstallPromptRef.current) {
        setIsIosManualInstall(true)
        setInstallGuideText('브라우저 메뉴(⋮/⋯) → 홈 화면에 추가를 선택하세요.')
        setShowInstallBanner(true)
      }
    }, 2200)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const closeInstallBanner = useCallback(() => {
    setShowInstallBanner(false)
    localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, '1')
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setShowInstallBanner(false)
      localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, '1')
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

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

  // 헤더 월 요약
  const monthlyTx = transactions.filter((t) => t.date.startsWith(yearMonth))
  const monthIncome = monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const showFAB = tab === 'home' || tab === 'transactions'

  return (
    <div className="min-h-screen bg-[#181818] pb-nav-safe">
      {/* SW 업데이트 토스트 */}
      {needRefresh && (
        <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div className="flex items-center gap-3 bg-[#252A3F] border border-[#3D8EF8]/30 rounded-2xl px-4 py-3.5 shadow-xl">
            <RefreshCw size={16} className="text-[#3D8EF8] shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
            <p className="text-sm font-semibold text-white flex-1">새 버전이 있어요!</p>
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors shrink-0"
            >
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
              className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isCurrentMonth()
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
          aria-label="내역 추가"
          className="fixed right-5 bottom-fab-safe w-8 h-8 bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-95 text-white rounded-full shadow-2xl shadow-[#3D8EF8]/30 flex items-center justify-center transition-all z-30"
        >
          <Plus size={20} />
        </button>
      )}

      {/* ── 도움말 버튼 ── */}
      <button
        onClick={() => setShowHelp(true)}
        aria-label="사용 가이드"
        className="fixed left-5 bottom-fab-safe w-8 h-8 bg-[#1E2236] border border-white/10 hover:bg-[#252A3F] active:scale-95 text-[#4E5968] hover:text-[#8B95A1] rounded-full flex items-center justify-center transition-all z-30 text-sm font-bold"
      >
        ?
      </button>

      {/* ── 하단 탭 ── */}
      {showInstallBanner && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-banner-safe z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div className="bg-[#252A3F] border border-[#3D8EF8]/25 rounded-2xl px-4 py-3.5 shadow-xl">
            <p className="text-sm font-semibold text-white">앱처럼 빠르게 사용하려면 홈 화면에 추가하세요.</p>
            <p className="text-[11px] text-[#8B95A1] mt-1">
              {isIosManualInstall ? installGuideText : '설치 버튼을 눌러 가계부 앱을 설치할 수 있어요.'}
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={closeInstallBanner}
                className="px-3 py-1.5 rounded-xl bg-[#1E2236] text-[#8B95A1] text-xs font-bold"
              >
                닫기
              </button>
              {!isIosManualInstall && deferredPrompt && (
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors"
                >
                  설치
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto bg-[#0D0F14] border-t border-white/6">
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

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm pointer-events-none">
          <div className="flex items-center gap-3 bg-[#252A3F] border border-white/10 rounded-2xl px-4 py-3 shadow-xl">
            <CheckCircle2 size={16} className="text-[#2ACF6A] shrink-0" />
            <p className="text-sm font-semibold text-white">{toastMsg}</p>
          </div>
        </div>
      )}

      {/* ── 모달 ── */}
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
        />
      )}
    </div>
  )
}
