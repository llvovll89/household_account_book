import { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, BarChart2, StickyNote, FileDown, RefreshCw, CheckCircle2, LogOut, Wallet, CreditCard, Target, WifiOff, CloudOff } from 'lucide-react'
import type { Transaction, Memo, Budget, RecurringTransaction, TransactionType, StockTrade, Subscription, SavingsGoal } from './types'
import type { AppMode, StockSubTab, Tab } from './types/navigation'
import { loadAllData, loadSettings, saveBudgets, saveMemos, saveRecurring, saveSettings, saveStockTrades, saveSubscriptions, saveGoals, saveTransactions } from './lib/storage'
import { generateId } from './lib/format'
import { usePWAInstall } from './hooks/usePWAInstall'
import { useAuthSync } from './hooks/useAuthSync'
import { registerToastHandler, showToast } from './lib/toast'
import { auth } from './firebase/firebase'
import { deleteReceiptImage } from './lib/receiptStorage'
import TransactionModal from './components/TransactionModal'
import ImportModal from './components/ImportModal'
import HelpModal from './components/HelpModal'
import StockTradeModal from './components/StockTradeModal'
import CategoryModal from './components/CategoryModal'
import LedgerWorkspace from './components/workspaces/LedgerWorkspace'
import StocksWorkspace from './components/workspaces/StocksWorkspace'
import BottomNavigation from './components/layout/BottomNavigation'
import MergeLocalDataModal from './components/MergeLocalDataModal'

const DATA_LOAD_TIMEOUT_MS = 9000

function getYearMonth(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function calcNet(items: Transaction[]) {
    return items.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
}

const LEDGER_TABS = [
    { id: 'home' as Tab, label: '홈', Icon: LayoutDashboard },
    { id: 'transactions' as Tab, label: '내역', Icon: List },
    { id: 'analytics' as Tab, label: '분석', Icon: BarChart2 },
    { id: 'subscriptions' as Tab, label: '구독', Icon: CreditCard },
    { id: 'goals' as Tab, label: '목표', Icon: Target },
    { id: 'memos' as Tab, label: '메모', Icon: StickyNote },
]

// ── UI 전용 상태 (모달 열림/닫힘, 트리거 카운터) ──────────────────────────────
interface UIState {
    showModal: boolean
    editingTransaction: Transaction | null
    showImport: boolean
    showHelp: boolean
    showStockModal: boolean
    editingTrade: StockTrade | null
    stockSubTab: StockSubTab
    showCategoryModal: boolean
    memoAddTrigger: number
    subscriptionAddTrigger: number
    goalAddTrigger: number
}

type UIAction =
    | { type: 'OPEN_TX_MODAL'; editing?: Transaction }
    | { type: 'CLOSE_TX_MODAL' }
    | { type: 'OPEN_STOCK_MODAL'; editing?: StockTrade }
    | { type: 'CLOSE_STOCK_MODAL' }
    | { type: 'SET_IMPORT'; value: boolean }
    | { type: 'SET_HELP'; value: boolean }
    | { type: 'SET_CATEGORY'; value: boolean }
    | { type: 'SET_STOCK_SUBTAB'; value: StockSubTab }
    | { type: 'TRIGGER_MEMO' }
    | { type: 'TRIGGER_SUB' }
    | { type: 'TRIGGER_GOAL' }

const UI_INIT: UIState = {
    showModal: false, editingTransaction: null,
    showImport: false, showHelp: false,
    showStockModal: false, editingTrade: null,
    stockSubTab: 'portfolio', showCategoryModal: false,
    memoAddTrigger: 0, subscriptionAddTrigger: 0, goalAddTrigger: 0,
}

function uiReducer(state: UIState, action: UIAction): UIState {
    switch (action.type) {
        case 'OPEN_TX_MODAL': return { ...state, showModal: true, editingTransaction: action.editing ?? null }
        case 'CLOSE_TX_MODAL': return { ...state, showModal: false, editingTransaction: null }
        case 'OPEN_STOCK_MODAL': return { ...state, showStockModal: true, editingTrade: action.editing ?? null }
        case 'CLOSE_STOCK_MODAL': return { ...state, showStockModal: false, editingTrade: null }
        case 'SET_IMPORT': return { ...state, showImport: action.value }
        case 'SET_HELP': return { ...state, showHelp: action.value }
        case 'SET_CATEGORY': return { ...state, showCategoryModal: action.value }
        case 'SET_STOCK_SUBTAB': return { ...state, stockSubTab: action.value }
        case 'TRIGGER_MEMO': return { ...state, memoAddTrigger: state.memoAddTrigger + 1 }
        case 'TRIGGER_SUB': return { ...state, subscriptionAddTrigger: state.subscriptionAddTrigger + 1 }
        case 'TRIGGER_GOAL': return { ...state, goalAddTrigger: state.goalAddTrigger + 1 }
    }
}

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

    const [mode, setMode] = useState<AppMode>('ledger')
    const [tab, setTab] = useState<Tab>('home')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [stockTrades, setStockTrades] = useState<StockTrade[]>([])
    const [stockWatchlist, setStockWatchlist] = useState<string[]>([])
    const [memos, setMemos] = useState<Memo[]>([])
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([])

    const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([])
    const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([])
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [goals, setGoals] = useState<SavingsGoal[]>([])

    // UI 전용 상태: 11개 useState → useReducer 1개로 통합
    const [ui, dispatchUI] = useReducer(uiReducer, UI_INIT)
    const {
        showModal, editingTransaction, showImport, showHelp,
        showStockModal, editingTrade, stockSubTab, showCategoryModal,
        memoAddTrigger, subscriptionAddTrigger, goalAddTrigger,
    } = ui

    // 오프라인 / 미동기화 상태
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [hasPendingSync, setHasPendingSync] = useState(
        () => localStorage.getItem('hb_pending_sync') === 'true'
    )

    const [toastMsg, setToastMsg] = useState<string | null>(null)
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return registerToastHandler((msg, duration = 2500) => {
            setToastMsg(msg)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setToastMsg(null), duration)
        })
    }, [])

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true)
            setHasPendingSync(localStorage.getItem('hb_pending_sync') === 'true')
        }
        const onOffline = () => setIsOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
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
        setSubscriptions(snapshot.subscriptions ?? [])
        setGoals(snapshot.goals ?? [])
        setStockWatchlist(snapshot.settings.stockWatchlist ?? [])
        setCustomExpenseCategories(snapshot.settings.customExpenseCategories)
        setCustomIncomeCategories(snapshot.settings.customIncomeCategories)
    }, [])

    const {
        user,
        authReady,
        isSyncing,
        settingsVersion,
        showMergeModal,
        localDataCounts,
        showAuthModal,
        authMode,
        email,
        password,
        authBusy,
        setShowAuthModal,
        setAuthMode,
        setEmail,
        setPassword,
        handleMergeConfirm,
        handleMergeCancel,
        handleGoogleLogin,
        handleEmailAuth,
        handleLogout,
    } = useAuthSync({ hydrateData })

    const activeMode: AppMode = user ? mode : 'ledger'
    const visibleTabs = LEDGER_TABS
    const activeTab: Tab = activeMode === 'stocks' ? 'stocks' : (tab === 'stocks' ? 'home' : tab)

    const persist = useCallback((task: Promise<void>, failMsg: string) => {
        void task
            .then(() => setHasPendingSync(false))
            .catch((e) => {
                console.error('[persist]', failMsg, e)
                showToast(failMsg)
                setHasPendingSync(true)
            })
    }, [])

    const handleSaveTransaction = useCallback(
        (items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
            setTransactions((prev) => {
                let next = prev
                if (editingTransaction && items.length > 0) {
                    // 수정 모드: 첫 번째 항목으로 수정
                    next = prev.map((t) => t.id === editingTransaction.id ? { ...t, ...items[0] } : t)
                    // 나머지는 신규 추가
                    const extra = items.slice(1).map((d) => ({ ...d, id: generateId(), createdAt: Date.now() }))
                    next = [...next, ...extra]
                } else {
                    next = [...prev, ...items.map((d) => ({ ...d, id: generateId(), createdAt: Date.now() }))]
                }
                persist(saveTransactions(next), '거래 저장에 실패했습니다.')
                return next
            })
            dispatchUI({ type: 'CLOSE_TX_MODAL' })
        },
        [editingTransaction, persist]
    )

    const handleDeleteTransaction = useCallback((id: string) => {
        if (!confirm('이 내역을 삭제할까요?')) return
        setTransactions((prev) => {
            const transaction = prev.find((t) => t.id === id)

            // 영수증 이미지 삭제
            if (transaction?.receiptImageUrl && auth.currentUser) {
                void deleteReceiptImage(auth.currentUser.uid, id).catch((e) => {
                    console.error('Failed to delete receipt image:', e)
                })
            }

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
        dispatchUI({ type: 'CLOSE_STOCK_MODAL' })
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

    const handleSubscriptionsChange = useCallback((items: Subscription[]) => {
        setSubscriptions(items)
        persist(saveSubscriptions(items), '구독 저장에 실패했습니다.')
    }, [persist])

    const handleGoalsChange = useCallback((items: SavingsGoal[]) => {
        setGoals(items)
        persist(saveGoals(items), '목표 저장에 실패했습니다.')
    }, [persist])

    const handleApplyRecurring = useCallback(async (pending: RecurringTransaction[]) => {
        const newTx: Transaction[] = pending.map((r) => ({
            id: generateId(),
            type: r.type,
            amount: r.amount,
            category: r.category,
            description: r.description,
            date: `${yearMonth}-${String(r.dayOfMonth).padStart(2, '0')}`,
            createdAt: Date.now(),
        }))
        const newTxIds = new Set(newTx.map((t) => t.id))
        const nextTxs = [...transactions, ...newTx]

        setTransactions(nextTxs)

        try {
            await saveTransactions(nextTxs)
        } catch (e) {
            console.error('[handleApplyRecurring] 거래 저장 실패', e)
            showToast('정기내역 적용 저장에 실패했습니다.')
            // 저장 실패 시 추가했던 거래를 롤백
            setTransactions((prev) => prev.filter((t) => !newTxIds.has(t.id)))
            return
        }

        // 거래 저장 성공 확인 후에만 lastAppliedMonth 업데이트
        setRecurring((prev) => {
            const ids = new Set(pending.map((r) => r.id))
            const next = prev.map((r) => ids.has(r.id) ? { ...r, lastAppliedMonth: yearMonth } : r)
            persist(saveRecurring(next), '정기내역 상태 저장에 실패했습니다.')
            return next
        })
    }, [transactions, persist, yearMonth])

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

    const handleAddWatchTicker = useCallback((ticker: string) => {
        const normalized = ticker.trim().toUpperCase()
        if (!normalized) return

        setStockWatchlist((prev) => {
            if (prev.includes(normalized)) return prev
            const next = [...prev, normalized]
            persist(
                (async () => {
                    const current = await loadSettings()
                    await saveSettings({ ...current, stockWatchlist: next })
                })(),
                '관심종목 저장에 실패했습니다.'
            )
            return next
        })
    }, [persist])

    const handleRemoveWatchTicker = useCallback((ticker: string) => {
        setStockWatchlist((prev) => {
            const next = prev.filter((item) => item !== ticker)
            persist(
                (async () => {
                    const current = await loadSettings()
                    await saveSettings({ ...current, stockWatchlist: next })
                })(),
                '관심종목 저장에 실패했습니다.'
            )
            return next
        })
    }, [persist])

    const handleAddMemo = useCallback((title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => {
        setMemos((prev) => {
            const now = Date.now()
            const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now, date, dateEnd, amount, transactionType, category }]
            persist(saveMemos(next), '메모 저장에 실패했습니다.')
            return next
        })
    }, [persist])

    const handleUpdateMemo = useCallback((id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => {
        setMemos((prev) => {
            const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now(), date, dateEnd, amount, transactionType, category } : m)
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

    const prevMonth = useCallback(() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
    const nextMonth = useCallback(() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])
    const isCurrentMonth = () => {
        const now = new Date()
        return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
    }

    const { monthlyTx, openingBalance, monthIncome, monthExpense, monthBalance } = useMemo(() => {
        const cutoff = `${yearMonth}-01`
        let income = 0, expense = 0, opening = 0
        const monthly: Transaction[] = []
        for (const t of transactions) {
            if (t.date < cutoff) {
                opening += t.type === 'income' ? t.amount : -t.amount
            } else if (t.date.startsWith(yearMonth)) {
                monthly.push(t)
                if (t.type === 'income') income += t.amount
                else expense += t.amount
            }
        }
        return {
            monthlyTx: monthly,
            openingBalance: opening,
            monthIncome: income,
            monthExpense: expense,
            monthBalance: opening + income - expense,
        }
    }, [transactions, yearMonth])
    const stockTickerCount = useMemo(() => new Set(stockTrades.map((t) => t.ticker)).size, [stockTrades])

    const showFAB = activeMode === 'stocks'
        ? stockSubTab === 'portfolio' || stockSubTab === 'trades'
        : activeTab === 'home' || activeTab === 'transactions' || activeTab === 'memos' || activeTab === 'subscriptions' || activeTab === 'goals'

    if (!authReady || isSyncing) {
        return (
            <div className="min-h-screen bg-[#111111] flex items-center justify-center px-6">
                <div className="w-full max-w-sm rounded-3xl bg-[#1C1C1E] border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-black/40 p-6 text-center">
                    <div className="mx-auto w-11 h-11 rounded-2xl bg-[#3D8EF8]/10 border border-[rgba(255,255,255,0.08)] flex items-center justify-center">
                        <Wallet size={20} className="text-[#3D8EF8]" />
                    </div>
                    <h2 className="mt-4 text-[17px] font-extrabold text-white tracking-tight">잔고플랜 준비 중</h2>
                    <p className="mt-1 text-sm text-[#8B95A1] font-medium">데이터를 안전하게 불러오고 있어요</p>
                    <div className="mt-4 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3D8EF8] animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3D8EF8]/80 animate-pulse [animation-delay:180ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3D8EF8]/65 animate-pulse [animation-delay:360ms]" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#111111] pb-nav-safe">
            {needRefresh && (
                <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm">
                    <div className="flex items-center gap-3 bg-[#1C1C1E] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 shadow-xl">
                        <RefreshCw size={16} className="text-[#3D8EF8] shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
                        <p className="text-sm font-semibold text-white flex-1">새 버전이 있어요!</p>
                        <button onClick={() => updateServiceWorker(true)} className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors shrink-0">
                            업데이트
                        </button>
                    </div>
                </div>
            )}

            <header className="bg-[#111111] sticky top-0 z-40">
                <div className="max-w-lg mx-auto px-5 pt-header-safe pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-xl bg-[#3D8EF8]/10 border border-[rgba(255,255,255,0.08)] flex items-center justify-center">
                                <Wallet size={14} className="text-[#3D8EF8]" />
                            </span>
                            <h1 className="text-[20px] font-extrabold text-white tracking-tight">잔고플랜</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {activeMode === 'ledger' && (
                                <button onClick={() => dispatchUI({ type: 'SET_IMPORT', value: true })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#8B95A1] bg-[#1C1C1E] hover:bg-[#2C2C2E] transition-colors border border-[rgba(255,255,255,0.06)]">
                                    <FileDown size={13} />
                                    가져오기
                                </button>
                            )}
                            {/* 오프라인 / 미동기화 상태 배지 */}
                            {(!isOnline || hasPendingSync) && (
                                <div
                                    title={!isOnline ? '오프라인 상태입니다' : '저장되지 않은 변경사항이 있어요'}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2C2C2E] border border-white/6"
                                >
                                    {!isOnline
                                        ? <WifiOff size={11} className="text-[#F25260]" />
                                        : <CloudOff size={11} className="text-[#F5BE3A]" />
                                    }
                                    <span className="text-[10px] font-bold text-[#8B95A1]">
                                        {!isOnline ? '오프라인' : '미동기화'}
                                    </span>
                                </div>
                            )}
                            {user ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl bg-[#2C2C2E] border border-[rgba(255,255,255,0.06)] max-w-37.5">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="profile" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-[#3D8EF8]/25 text-[#79B2FF] text-[10px] font-bold flex items-center justify-center">
                                                {(user.email?.[0] ?? 'U').toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-[11px] text-[#C8D1DC] truncate">{user.email?.split('@')[0] ?? '로그인 사용자'}</span>
                                    </div>
                                    <button onClick={handleLogout} aria-label="로그아웃" title="로그아웃" className="w-8 h-8 rounded-xl text-[#8B95A1] bg-[#2C2C2E] hover:bg-[#3A3A3C] transition-colors border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
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

                    <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] p-1.5">
                        <button
                            onClick={() => {
                                setMode('ledger')
                                if (tab === 'stocks') setTab('home')
                            }}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${activeMode === 'ledger' ? 'bg-[#3D8EF8] text-white' : 'text-[#8B95A1] hover:bg-white/5'}`}
                        >
                            가계부
                        </button>
                        <button
                            onClick={() => {
                                if (!user) {
                                    setShowAuthModal(true)
                                    showToast('주식 모드는 로그인 후 사용할 수 있어요.')
                                    return
                                }
                                setMode('stocks')
                                setTab('stocks')
                                dispatchUI({ type: 'SET_STOCK_SUBTAB', value: 'portfolio' })
                            }}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${activeMode === 'stocks' ? 'bg-[#F5BE3A] text-[#111111]' : 'text-[#8B95A1] hover:bg-white/5'}`}
                        >
                            주식
                        </button>
                    </div>

                    {activeMode === 'ledger' ? (
                        <>
                            <div className="flex items-center justify-center gap-3 mt-3">
                                <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform">
                                    <ChevronLeft size={16} className="text-[#8B95A1]" />
                                </button>
                                <button onClick={() => setCurrentDate(new Date())} className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isCurrentMonth() ? 'bg-white text-[#111111]' : 'bg-[#1C1C1E] text-[#8B95A1] border border-[rgba(255,255,255,0.06)]'}`}>
                                    {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                                </button>
                                <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform">
                                    <ChevronRight size={16} className="text-[#8B95A1]" />
                                </button>
                            </div>

                            {(monthIncome > 0 || monthExpense > 0) && (
                                <div className="flex items-center justify-center gap-4 mt-3 pb-1">
                                    <span className="text-xs font-semibold text-[#2ACF6A] num">+{monthIncome.toLocaleString()}</span>
                                    <div className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.12)]" />
                                    <span className="text-xs font-semibold text-[#F25260] num">-{monthExpense.toLocaleString()}</span>
                                    <div className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.12)]" />
                                    <span className={`text-xs font-bold num ${monthBalance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                                        {monthBalance.toLocaleString()}원
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="mt-3 pb-1 bg-[#1C1C1E] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4">
                            <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">투자 워크스페이스</p>
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-[#F5F7FA]">총 거래 {stockTrades.length.toLocaleString()}건</p>
                                <p className="text-xs font-semibold text-[#8B95A1]">보유 종목 {stockTickerCount}개</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="h-px bg-white/4 mx-5" />
            </header>

            <main className="max-w-lg mx-auto px-4 py-4">
                {activeMode === 'ledger' && (
                    <LedgerWorkspace
                        activeTab={activeTab}
                        transactions={transactions}
                        budgets={budgets}
                        recurring={recurring}
                        subscriptions={subscriptions}
                        goals={goals}
                        settingsVersion={settingsVersion}
                        yearMonth={yearMonth}
                        customExpenseCategories={customExpenseCategories}
                        memos={memos}
                        memoAddTrigger={memoAddTrigger}
                        subscriptionAddTrigger={subscriptionAddTrigger}
                        goalAddTrigger={goalAddTrigger}
                        onBudgetsChange={handleBudgetsChange}
                        onRecurringSave={handleRecurringSave}
                        onApplyRecurring={handleApplyRecurring}
                        onSubscriptionsChange={handleSubscriptionsChange}
                        onGoalsChange={handleGoalsChange}
                        onOpenCategoryModal={() => dispatchUI({ type: 'SET_CATEGORY', value: true })}
                        onTransactionEdit={(t) => dispatchUI({ type: 'OPEN_TX_MODAL', editing: t })}
                        onTransactionDelete={handleDeleteTransaction}
                        onMemoAdd={handleAddMemo}
                        onMemoUpdate={handleUpdateMemo}
                        onMemoDelete={handleDeleteMemo}
                        onMemoTogglePin={handleTogglePin}
                    />
                )}
                {activeTab === 'stocks' && (
                    <StocksWorkspace
                        stockSubTab={stockSubTab}
                        stockTrades={stockTrades}
                        stockWatchlist={stockWatchlist}
                        onStockSubTabChange={(v) => dispatchUI({ type: 'SET_STOCK_SUBTAB', value: v })}
                        onTradeEdit={(t) => dispatchUI({ type: 'OPEN_STOCK_MODAL', editing: t })}
                        onTradeDelete={handleDeleteStockTrade}
                        onWatchAdd={handleAddWatchTicker}
                        onWatchRemove={handleRemoveWatchTicker}
                    />
                )}
            </main>

            <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
                <div className="max-w-lg mx-auto relative h-0">
                    {showFAB && (
                        <button
                            onClick={() => {
                                if (activeTab === 'stocks' && (stockSubTab === 'portfolio' || stockSubTab === 'trades')) {
                                    dispatchUI({ type: 'OPEN_STOCK_MODAL' })
                                } else if (activeTab === 'memos') {
                                    dispatchUI({ type: 'TRIGGER_MEMO' })
                                } else if (activeTab === 'subscriptions') {
                                    dispatchUI({ type: 'TRIGGER_SUB' })
                                } else if (activeTab === 'goals') {
                                    dispatchUI({ type: 'TRIGGER_GOAL' })
                                } else {
                                    dispatchUI({ type: 'OPEN_TX_MODAL' })
                                }
                            }}
                            aria-label="내역 추가"
                            className="pointer-events-auto absolute right-5 bottom-fab-safe w-8 h-8 bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-95 text-white rounded-full shadow-2xl shadow-black/40 flex items-center justify-center transition-all"
                        >
                            <Plus size={20} />
                        </button>
                    )}

                    <button onClick={() => dispatchUI({ type: 'SET_HELP', value: true })} aria-label="사용 가이드" className="pointer-events-auto absolute left-5 bottom-fab-safe w-8 h-8 bg-[#F5F7F8] border border-white/10 hover:bg-[#252A3F] active:scale-95 text-[#4E5968] hover:text-[#8B95A1] rounded-full flex items-center justify-center transition-all text-sm font-bold">
                        ?
                    </button>
                </div>
            </div>

            {showInstallBanner && (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-banner-safe z-50 w-[calc(100%-2.5rem)] max-w-sm">
                    <div className="bg-[#1C1C1E] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 shadow-xl">
                        <p className="text-sm font-semibold text-white">앱처럼 빠르게 사용하려면 홈 화면에 추가하세요.</p>
                        <p className="text-[11px] text-[#8B95A1] mt-1">
                            {isIosManualInstall ? installGuideText : '설치 버튼을 눌러 잔고플랜 앱을 설치할 수 있어요.'}
                        </p>
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <button onClick={closeInstallBanner} className="px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] text-xs font-bold">닫기</button>
                            {!isIosManualInstall && deferredPrompt && (
                                <button onClick={handleInstallClick} className="px-3 py-1.5 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors">설치</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <BottomNavigation
                activeMode={activeMode}
                ledgerTabs={visibleTabs}
                activeTab={activeTab}
                stockSubTab={stockSubTab}
                onLedgerTabChange={setTab}
                onStockSubTabChange={(v) => dispatchUI({ type: 'SET_STOCK_SUBTAB', value: v })}
            />

            {toastMsg && (
                <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm pointer-events-none">
                    <div className="flex items-center gap-3 bg-[#1C1C1E] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 shadow-xl">
                        <CheckCircle2 size={16} className="text-[#2ACF6A] shrink-0" />
                        <p className="text-sm font-semibold text-white">{toastMsg}</p>
                    </div>
                </div>
            )}

            {showStockModal && (
                <StockTradeModal
                    trade={editingTrade}
                    onSave={handleSaveStockTrade}
                    onClose={() => dispatchUI({ type: 'CLOSE_STOCK_MODAL' })}
                />
            )}
            {showHelp && <HelpModal onClose={() => dispatchUI({ type: 'SET_HELP', value: false })} />}
            {showImport && (
                <ImportModal
                    existingTransactions={transactions}
                    onImport={handleBulkImport}
                    onClose={() => dispatchUI({ type: 'SET_IMPORT', value: false })}
                />
            )}
            {showModal && (
                <TransactionModal
                    transaction={editingTransaction}
                    onSave={handleSaveTransaction}
                    onClose={() => dispatchUI({ type: 'CLOSE_TX_MODAL' })}
                    customExpenseCategories={customExpenseCategories}
                    customIncomeCategories={customIncomeCategories}
                />
            )}
            {showCategoryModal && (
                <CategoryModal
                    customExpenseCategories={customExpenseCategories}
                    customIncomeCategories={customIncomeCategories}
                    onSave={handleSaveCategories}
                    onClose={() => dispatchUI({ type: 'SET_CATEGORY', value: false })}
                />
            )}

            {showMergeModal && (
                <MergeLocalDataModal onConfirm={handleMergeConfirm} onCancel={handleMergeCancel} counts={localDataCounts} />
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
