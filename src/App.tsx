import { Suspense, lazy, useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ChevronLeft, ChevronRight, Plus, LayoutDashboard, List, BarChart2, StickyNote, FileDown, RefreshCw, CheckCircle2, AlertTriangle, Info, LogOut, Wallet, CreditCard, Target, WifiOff, CloudOff } from 'lucide-react'
import type { AutoCategoryRule, DashboardWidgetId, Transaction, Memo, Budget, RecurringTransaction, StockTrade, Subscription, SavingsGoal, UserPaymentMethod, TransactionTemplate, TransactionType } from './types'
import type { AppMode, StockSubTab, Tab } from './types/navigation'
import { loadAllData, loadSettings } from './lib/storage'
import type { RemoteVersionKey } from './lib/storage'
import { isStorageConflictError } from './lib/storage'
import { calculateCardDueAmount, shiftYM } from './lib/cardBilling'
import { usePWAInstall } from './hooks/usePWAInstall'
import { useAuthSync } from './hooks/useAuthSync'
import { useAppHandlers } from './hooks/useAppHandlers'
import type { UIAction } from './hooks/useAppHandlers.types'
import { registerToastHandler, showToast, type ToastVariant, type ToastAction } from './lib/toast'
import BottomNavigation from './components/layout/BottomNavigation'
import WorkspaceSkeleton from './components/layout/WorkspaceSkeleton'

const TransactionModal = lazy(() => import('./components/TransactionModal'))
const ImportModal = lazy(() => import('./components/ImportModal'))
const HelpModal = lazy(() => import('./components/HelpModal'))
const StockTradeModal = lazy(() => import('./components/StockTradeModal'))
const CategoryModal = lazy(() => import('./components/CategoryModal'))
const PaymentMethodsModal = lazy(() => import('./components/PaymentMethodsModal'))
const LedgerWorkspace = lazy(() => import('./components/workspaces/LedgerWorkspace'))
const StocksWorkspace = lazy(() => import('./components/workspaces/StocksWorkspace'))
const MergeLocalDataModal = lazy(() => import('./components/MergeLocalDataModal'))
const AutoApplyRecurringModal = lazy(() => import('./components/AutoApplyRecurringModal'))
const SyncConflictModal = lazy(() => import('./components/SyncConflictModal'))
const SyncRecoveryGuideModal = lazy(() => import('./components/SyncRecoveryGuideModal'))
const AutoCategoryRuleModal = lazy(() => import('./components/AutoCategoryRuleModal'))
const TagManagerModal = lazy(() => import('./components/TagManagerModal'))
const DashboardWidgetSettings = lazy(() => import('./components/DashboardWidgetSettings'))

const DATA_LOAD_TIMEOUT_MS = 9000
const FILTER_TYPE_KEY = 'hb_tx_type_filter'
const METHOD_FILTER_KEY = 'hb_tx_method_filter'
const BILLING_FILTER_KEY = 'hb_tx_billing_filter'
const STATEMENT_MONTH_FILTER_KEY = 'hb_tx_statement_month_filter'
const CONFLICT_SCOPE_PREF_KEY = 'hb_conflict_scope_pref'
const CONFLICT_POLICY_REMEMBER_KEY = 'hb_conflict_policy_remember'
const AUTO_APPLY_RECURRING_MODE_KEY = 'hb_recurring_auto_apply_mode'

type AutoApplyRecurringMode = 'ask' | 'always' | 'never'

function getYearMonth(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseConflictScopePreference(): RemoteVersionKey[] {
    try {
        const raw = localStorage.getItem(CONFLICT_SCOPE_PREF_KEY)
        if (!raw) return ['transactions', 'memos', 'budgets', 'recurring', 'stockTrades', 'subscriptions', 'goals']
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return ['transactions', 'memos', 'budgets', 'recurring', 'stockTrades', 'subscriptions', 'goals']
        const allowed: RemoteVersionKey[] = ['transactions', 'memos', 'budgets', 'recurring', 'stockTrades', 'subscriptions', 'goals', 'settings']
        const result = parsed.filter((item): item is RemoteVersionKey => allowed.includes(item as RemoteVersionKey))
        return result.length > 0 ? result : ['transactions', 'memos', 'budgets', 'recurring', 'stockTrades', 'subscriptions', 'goals']
    } catch {
        return ['transactions', 'memos', 'budgets', 'recurring', 'stockTrades', 'subscriptions', 'goals']
    }
}

function parseConflictPolicyRemember(): boolean {
    const raw = localStorage.getItem(CONFLICT_POLICY_REMEMBER_KEY)
    if (raw === '0') return false
    return true
}

function getDefaultSelectedConflictKeys(keys: RemoteVersionKey[], preferredScopes: RemoteVersionKey[]): RemoteVersionKey[] {
    const preferred = keys.filter((key) => preferredScopes.includes(key))
    if (preferred.length > 0) return preferred
    if (keys.length <= 1) return keys
    const withoutSettings = keys.filter((key) => key !== 'settings')
    return withoutSettings.length > 0 ? withoutSettings : keys
}

function parseAutoApplyRecurringMode(): AutoApplyRecurringMode {
    const raw = localStorage.getItem(AUTO_APPLY_RECURRING_MODE_KEY)
    if (raw === 'always' || raw === 'never' || raw === 'ask') return raw
    return 'ask'
}

function scopeLabel(scope: RemoteVersionKey): string {
    const labels: Record<RemoteVersionKey, string> = {
        transactions: '거래내역',
        memos: '메모',
        budgets: '예산',
        recurring: '반복거래',
        stockTrades: '주식거래',
        subscriptions: '구독',
        goals: '목표',
        settings: '설정',
    }
    return labels[scope]
}

function getRetryReasonTotals(reasonsByScope: Partial<Record<RemoteVersionKey, RetryReasonCode[]>>) {
    let conflict = 0
    let saveFailed = 0
    for (const reasons of Object.values(reasonsByScope)) {
        if ((reasons ?? []).includes('conflict')) conflict += 1
        if ((reasons ?? []).includes('save-failed')) saveFailed += 1
    }
    return { conflict, saveFailed }
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
    showPaymentMethodsModal: boolean
    memoAddTrigger: number
    subscriptionAddTrigger: number
    goalAddTrigger: number
    confirmModal: { message: string; onConfirm: () => void; confirmLabel?: string; confirmVariant?: 'danger' | 'primary' } | null
}

interface FailedPersistTask {
    id: string
    message: string
    run: () => Promise<void>
    scope: RemoteVersionKey
    attempts: number
    lastFailedAt: number
}

type ConflictVersionDiff = Partial<Record<RemoteVersionKey, { expected: number; remote: number }>>
type ConflictCountDiff = Partial<Record<RemoteVersionKey, { localCount: number | null; remoteCount: number | null }>>
type RetryReasonCode = 'conflict' | 'save-failed'
type RetryRunMode = 'all' | 'conflict-only' | 'save-failed-only'

interface RetryResultSummary {
    attempted: number
    succeeded: number
    failed: number
    mode: RetryRunMode
    finishedAt: number
    failedByScope: Array<{ scope: RemoteVersionKey; count: number }>
}

const UI_INIT: UIState = {
    showModal: false, editingTransaction: null,
    showImport: false, showHelp: false,
    showStockModal: false, editingTrade: null,
    stockSubTab: 'portfolio', showCategoryModal: false, showPaymentMethodsModal: false,
    memoAddTrigger: 0, subscriptionAddTrigger: 0, goalAddTrigger: 0,
    confirmModal: null,
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
        case 'SET_PAYMENT_METHODS': return { ...state, showPaymentMethodsModal: action.value }
        case 'SET_STOCK_SUBTAB': return { ...state, stockSubTab: action.value }
        case 'TRIGGER_MEMO': return { ...state, memoAddTrigger: state.memoAddTrigger + 1 }
        case 'TRIGGER_SUB': return { ...state, subscriptionAddTrigger: state.subscriptionAddTrigger + 1 }
        case 'TRIGGER_GOAL': return { ...state, goalAddTrigger: state.goalAddTrigger + 1 }
        case 'OPEN_CONFIRM': return { ...state, confirmModal: { message: action.message, onConfirm: action.onConfirm, confirmLabel: action.confirmLabel, confirmVariant: action.confirmVariant } }
        case 'CLOSE_CONFIRM': return { ...state, confirmModal: null }
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
    const swIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onNeedRefresh() { updateServiceWorker(true) },
        onRegistered(r) {
          if (swIntervalRef.current !== null) clearInterval(swIntervalRef.current)
          swIntervalRef.current = setInterval(() => r?.update(), 60 * 60 * 1000)
        },
    })

    const { showInstallBanner, isIosManualInstall, installGuideText, deferredPrompt, closeInstallBanner, handleInstallClick } = usePWAInstall()

    const [mode, setMode] = useState<AppMode>('ledger')
    const [tab, setTab] = useState<Tab>(() => {
        const saved = localStorage.getItem('hb_active_tab')
        const valid: Tab[] = ['home', 'transactions', 'analytics', 'memos', 'subscriptions', 'goals']
        return valid.includes(saved as Tab) ? (saved as Tab) : 'home'
    })
    const [currentDate, setCurrentDate] = useState(new Date())
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [stockTrades, setStockTrades] = useState<StockTrade[]>([])
    const [stockWatchlist, setStockWatchlist] = useState<string[]>([])
    const [cardBillingDay, setCardBillingDay] = useState<number | null>(null)
    const [settingsSyncTick, setSettingsSyncTick] = useState(0)
    const [memos, setMemos] = useState<Memo[]>([])
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([])

    const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([])
    const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([])
    const [userPaymentMethods, setUserPaymentMethods] = useState<UserPaymentMethod[]>([])
    const [transactionTemplates, setTransactionTemplates] = useState<TransactionTemplate[]>([])
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [goals, setGoals] = useState<SavingsGoal[]>([])
    const [autoCategoryRules, setAutoCategoryRules] = useState<AutoCategoryRule[]>([])
    const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetId[]>([])
    const [showTagManagerModal, setShowTagManagerModal] = useState(false)
    const [showAutoCategoryRuleModal, setShowAutoCategoryRuleModal] = useState(false)
    const [showWidgetSettings, setShowWidgetSettings] = useState(false)
    const [fabExpanded, setFabExpanded] = useState(false)
    const [txInitialType, setTxInitialType] = useState<TransactionType>('expense')

    // UI 전용 상태: 11개 useState → useReducer 1개로 통합
    const [ui, dispatchUI] = useReducer(uiReducer, UI_INIT)
    const {
        showModal, editingTransaction, showImport, showHelp,
        showStockModal, editingTrade, stockSubTab, showCategoryModal, showPaymentMethodsModal,
        memoAddTrigger, subscriptionAddTrigger, goalAddTrigger, confirmModal,
    } = ui

    // 오프라인 / 미동기화 상태
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [hasPendingSync, setHasPendingSync] = useState(
        () => localStorage.getItem('hb_pending_sync') === 'true'
    )
    const [failedPersistTasks, setFailedPersistTasks] = useState<FailedPersistTask[]>([])
    const [lastRetryReasons, setLastRetryReasons] = useState<Partial<Record<RemoteVersionKey, RetryReasonCode[]>>>({})
    const [isRetryingPersist, setIsRetryingPersist] = useState(false)
    const [retryProgress, setRetryProgress] = useState<{ done: number; total: number } | null>(null)
    const [lastRetryResult, setLastRetryResult] = useState<RetryResultSummary | null>(null)
    const [showSyncConflictModal, setShowSyncConflictModal] = useState(false)
    const [showSyncRecoveryGuideModal, setShowSyncRecoveryGuideModal] = useState(false)
    const [conflictKeys, setConflictKeys] = useState<RemoteVersionKey[]>([])
    const [selectedConflictKeys, setSelectedConflictKeys] = useState<RemoteVersionKey[]>([])
    const [conflictVersionDiffs, setConflictVersionDiffs] = useState<ConflictVersionDiff>({})
    const [conflictCountDiffs, setConflictCountDiffs] = useState<ConflictCountDiff>({})
    const [conflictRemoteUpdatedAt, setConflictRemoteUpdatedAt] = useState<number | null>(null)
    const [conflictPreferredScopes, setConflictPreferredScopes] = useState<RemoteVersionKey[]>(() => parseConflictScopePreference())
    const [rememberConflictPolicy, setRememberConflictPolicy] = useState<boolean>(() => parseConflictPolicyRemember())

    const [toastMsg, setToastMsg] = useState<string | null>(null)
    const [toastVariant, setToastVariant] = useState<ToastVariant>('success')
    const [toastAction, setToastAction] = useState<ToastAction | null>(null)
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [autoApplyPending, setAutoApplyPending] = useState<RecurringTransaction[]>([])
    const [showAutoApplyModal, setShowAutoApplyModal] = useState(false)
    const [autoApplyMode, setAutoApplyMode] = useState<AutoApplyRecurringMode>(() => parseAutoApplyRecurringMode())
    const autoApplyCheckedRef = useRef(false)

    const [showUserMenu, setShowUserMenu] = useState(false)
    const userMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!showUserMenu) return
        const handleOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false)
            }
        }
        document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [showUserMenu])

    useEffect(() => {
        return registerToastHandler((msg, duration = 2500, variant = 'success', action) => {
            setToastMsg(msg)
            setToastVariant(variant)
            setToastAction(action ?? null)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => { setToastMsg(null); setToastAction(null) }, duration)
        })
    }, [])

    useEffect(() => {
        if (tab !== 'stocks') localStorage.setItem('hb_active_tab', tab)
    }, [tab])

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true)
            setHasPendingSync(localStorage.getItem('hb_pending_sync') === 'true')
            showToast('온라인으로 전환됐어요. 미동기화 항목을 다시 저장할 수 있어요.')
        }
        const onOffline = () => {
            setIsOnline(false)
            showToast('오프라인 상태예요. 변경사항은 임시 저장 후 연결 복구 시 동기화돼요.')
        }
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    useEffect(() => {
        const onSettingsUpdated = () => {
            void loadSettings().then((settings) => {
                setCardBillingDay(settings.cardBillingDay ?? null)
                setUserPaymentMethods(settings.userPaymentMethods)
                setTransactionTemplates(settings.transactionTemplates ?? [])
                setAutoCategoryRules(settings.autoCategoryRules ?? [])
                setHiddenWidgets(settings.hiddenWidgets ?? [])
            })
            setSettingsSyncTick((prev) => prev + 1)
        }

        window.addEventListener('hb-settings-updated', onSettingsUpdated)
        return () => {
            window.removeEventListener('hb-settings-updated', onSettingsUpdated)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem(CONFLICT_SCOPE_PREF_KEY, JSON.stringify(conflictPreferredScopes))
    }, [conflictPreferredScopes])

    useEffect(() => {
        localStorage.setItem(CONFLICT_POLICY_REMEMBER_KEY, rememberConflictPolicy ? '1' : '0')
    }, [rememberConflictPolicy])

    useEffect(() => {
        localStorage.setItem(AUTO_APPLY_RECURRING_MODE_KEY, autoApplyMode)
    }, [autoApplyMode])

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
        setCardBillingDay(snapshot.settings.cardBillingDay ?? null)
        setUserPaymentMethods(snapshot.settings.userPaymentMethods ?? [])
        setCustomExpenseCategories(snapshot.settings.customExpenseCategories)
        setCustomIncomeCategories(snapshot.settings.customIncomeCategories)
        setTransactionTemplates(snapshot.settings.transactionTemplates ?? [])
        setAutoCategoryRules(snapshot.settings.autoCategoryRules ?? [])
        setHiddenWidgets(snapshot.settings.hiddenWidgets ?? [])
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

    const prefetchLedgerTab = useCallback((target: Tab) => {
        if (target === 'home') {
            void import('./components/Dashboard')
            return
        }
        if (target === 'transactions') {
            void import('./components/TransactionList')
            return
        }
        if (target === 'analytics') {
            void import('./components/Analytics')
            return
        }
        if (target === 'memos') {
            void import('./components/MemoSection')
            return
        }
        if (target === 'subscriptions') {
            void import('./components/SubscriptionView')
            return
        }
        if (target === 'goals') {
            void import('./components/GoalsView')
        }
    }, [])

    const prefetchStockSubTab = useCallback((target: StockSubTab) => {
        if (target === 'portfolio') {
            void import('./components/StockPortfolio')
            return
        }
        if (target === 'watchlist') {
            void import('./components/StockWatchlist')
            return
        }
        if (target === 'trades') {
            void import('./components/StockTradeList')
            return
        }
        if (target === 'performance') {
            void import('./components/StockPerformance')
        }
    }, [])

    const prefetchMode = useCallback((target: AppMode) => {
        if (target === 'stocks') {
            prefetchStockSubTab('portfolio')
            prefetchStockSubTab('watchlist')
            return
        }
        prefetchLedgerTab('home')
        prefetchLedgerTab('transactions')
    }, [prefetchLedgerTab, prefetchStockSubTab])

    const prefetchFabModal = useCallback(() => {
        if (activeTab === 'stocks' && (stockSubTab === 'portfolio' || stockSubTab === 'trades')) {
            void import('./components/StockTradeModal')
            return
        }
        if (activeTab === 'memos' || activeTab === 'subscriptions' || activeTab === 'goals') {
            return
        }
        void import('./components/TransactionModal')
    }, [activeTab, stockSubTab])

    const prefetchImportUtilities = useCallback(() => {
        void import('./components/ImportModal')
        void import('./components/PaymentMethodsModal')
    }, [])

    const prefetchHelp = useCallback(() => {
        void import('./components/HelpModal')
    }, [])

    const transitionStartRef = useRef<number | null>(null)
    const transitionLabelRef = useRef<string | null>(null)

    const handleLedgerTabChange = useCallback((nextTab: Tab) => {
        if (import.meta.env.DEV) {
            transitionStartRef.current = performance.now()
            transitionLabelRef.current = `ledger:${nextTab}`
        }

        prefetchLedgerTab(nextTab)
        const likelyNext: Partial<Record<Tab, Tab>> = {
            home: 'transactions',
            transactions: 'analytics',
            analytics: 'home',
            memos: 'transactions',
            subscriptions: 'home',
            goals: 'home',
        }
        const predicted = likelyNext[nextTab]
        if (predicted) prefetchLedgerTab(predicted)
        setTab(nextTab)
        setFabExpanded(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [prefetchLedgerTab])

    const handleStockSubTabChange = useCallback((nextSubTab: StockSubTab) => {
        if (import.meta.env.DEV) {
            transitionStartRef.current = performance.now()
            transitionLabelRef.current = `stocks:${nextSubTab}`
        }

        prefetchStockSubTab(nextSubTab)
        const likelyNext: Partial<Record<StockSubTab, StockSubTab>> = {
            portfolio: 'watchlist',
            watchlist: 'trades',
            trades: 'performance',
            performance: 'portfolio',
        }
        const predicted = likelyNext[nextSubTab]
        if (predicted) prefetchStockSubTab(predicted)
        dispatchUI({ type: 'SET_STOCK_SUBTAB', value: nextSubTab })
    }, [prefetchStockSubTab])

    useEffect(() => {
        const preloadByContext = () => {
            if (activeMode === 'stocks') {
                prefetchStockSubTab('portfolio')
                prefetchStockSubTab('watchlist')
                prefetchStockSubTab('trades')
                prefetchStockSubTab('performance')
                void import('./components/StockTradeModal')
                return
            }

            if (activeTab === 'home') {
                prefetchLedgerTab('transactions')
                prefetchLedgerTab('analytics')
                void import('./components/TransactionModal')
                return
            }

            if (activeTab === 'transactions') {
                prefetchLedgerTab('home')
                prefetchLedgerTab('analytics')
                void import('./components/TransactionModal')
                return
            }

            if (activeTab === 'analytics') {
                prefetchLedgerTab('home')
                prefetchLedgerTab('transactions')
                return
            }

            if (activeTab === 'memos') {
                prefetchLedgerTab('transactions')
                return
            }

            if (activeTab === 'subscriptions' || activeTab === 'goals') {
                prefetchLedgerTab('home')
            }
        }

        const w = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
            cancelIdleCallback?: (id: number) => void
        }

        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let idleId: number | null = null

        if (w.requestIdleCallback) {
            idleId = w.requestIdleCallback(() => {
                preloadByContext()
            }, { timeout: 1200 })
        } else {
            timeoutId = setTimeout(() => {
                preloadByContext()
            }, 220)
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId)
        }
    }, [activeMode, activeTab, prefetchLedgerTab, prefetchStockSubTab])

    useEffect(() => {
        if (!import.meta.env.DEV) return
        if (transitionStartRef.current === null || !transitionLabelRef.current) return

        const startedAt = transitionStartRef.current
        const label = transitionLabelRef.current
        transitionStartRef.current = null
        transitionLabelRef.current = null

        const frame1 = requestAnimationFrame(() => {
            const frame2 = requestAnimationFrame(() => {
                const elapsed = performance.now() - startedAt
                console.debug(`[tab-transition] ${label} ${elapsed.toFixed(1)}ms`)
            })
            void frame2
        })

        return () => cancelAnimationFrame(frame1)
    }, [activeMode, activeTab, stockSubTab])

    const persist = useCallback((task: () => Promise<void>, failMsg: string, scope: RemoteVersionKey) => {
        void task()
            .then(() => setHasPendingSync(false))
            .catch((e) => {
                console.error('[persist]', failMsg, e)
                const message = isStorageConflictError(e)
                    ? '다른 기기에서 데이터가 변경되어 저장 충돌이 발생했어요. 동기화 후 다시 시도해주세요.'
                    : failMsg
                if (isStorageConflictError(e)) {
                    const keys = Array.from(new Set(e.conflictKeys))
                    setConflictKeys(keys)
                    setSelectedConflictKeys(getDefaultSelectedConflictKeys(keys, conflictPreferredScopes))
                    const nextDiffs: ConflictVersionDiff = {}
                    for (const key of keys) {
                        nextDiffs[key] = {
                            expected: e.expectedVersions[key],
                            remote: e.remoteVersions[key],
                        }
                    }
                    setConflictVersionDiffs(nextDiffs)
                    setConflictCountDiffs(e.countDiffs)
                    setConflictRemoteUpdatedAt(e.remoteUpdatedAt)
                    setShowSyncConflictModal(true)
                }
                showToast(message)
                setHasPendingSync(true)
                setFailedPersistTasks((prev) => {
                    const idx = prev.findIndex((item) => item.message === message && item.scope === scope)
                    if (idx >= 0) {
                        const copy = [...prev]
                        const current = copy[idx]
                        copy[idx] = {
                            ...current,
                            run: task,
                            scope,
                            attempts: current.attempts + 1,
                            lastFailedAt: Date.now(),
                        }
                        return copy
                    }
                    return [
                        ...prev,
                        {
                            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                            message,
                            run: task,
                            scope,
                            attempts: 1,
                            lastFailedAt: Date.now(),
                        },
                    ]
                })
            })
    }, [])

    const retryFailedPersistTasks = useCallback((allowedScopes?: RemoteVersionKey[], mode: RetryRunMode = 'all') => {
        if (isRetryingPersist) return
        const allow = allowedScopes && allowedScopes.length > 0 ? new Set<RemoteVersionKey>(allowedScopes) : null
        const queued = allow
            ? failedPersistTasks.filter((item) => allow.has(item.scope))
            : [...failedPersistTasks]
        if (queued.length === 0) {
            showToast('재시도할 저장 실패 항목이 없어요.')
            return
        }
        const untouched = allow
            ? failedPersistTasks.filter((item) => !allow.has(item.scope))
            : []
        setFailedPersistTasks(untouched)
        if (!allow) setLastRetryReasons({})
        setIsRetryingPersist(true)
        setRetryProgress({ done: 0, total: queued.length })

        void (async () => {
            try {
                const stillFailed: FailedPersistTask[] = []
                let succeededCount = 0
                const succeededScopes = new Set<RemoteVersionKey>()
                const failedScopes = new Set<RemoteVersionKey>()
                const failedReasons = new Map<RemoteVersionKey, Set<'conflict' | 'save-failed'>>()
                for (let i = 0; i < queued.length; i++) {
                    const item = queued[i]
                    try {
                        await item.run()
                        succeededCount += 1
                        succeededScopes.add(item.scope)
                    } catch (e) {
                        console.error('[persist-retry]', item.message, e)
                        const reason: 'conflict' | 'save-failed' = isStorageConflictError(e) ? 'conflict' : 'save-failed'
                        if (isStorageConflictError(e)) {
                            const keys = Array.from(new Set(e.conflictKeys))
                            setConflictKeys(keys)
                            setSelectedConflictKeys(getDefaultSelectedConflictKeys(keys, conflictPreferredScopes))
                            const nextDiffs: ConflictVersionDiff = {}
                            for (const key of keys) {
                                nextDiffs[key] = {
                                    expected: e.expectedVersions[key],
                                    remote: e.remoteVersions[key],
                                }
                            }
                            setConflictVersionDiffs(nextDiffs)
                            setConflictCountDiffs(e.countDiffs)
                            setConflictRemoteUpdatedAt(e.remoteUpdatedAt)
                            setShowSyncConflictModal(true)
                        }
                        failedScopes.add(item.scope)
                        const reasons = failedReasons.get(item.scope) ?? new Set<'conflict' | 'save-failed'>()
                        reasons.add(reason)
                        failedReasons.set(item.scope, reasons)
                        stillFailed.push({
                            ...item,
                            attempts: item.attempts + 1,
                            lastFailedAt: Date.now(),
                        })
                    } finally {
                        setRetryProgress({ done: i + 1, total: queued.length })
                    }
                }

                setLastRetryResult({
                    attempted: queued.length,
                    succeeded: succeededCount,
                    failed: stillFailed.length,
                    mode,
                    finishedAt: Date.now(),
                    failedByScope: Array.from(
                        stillFailed.reduce((acc, item) => {
                            acc.set(item.scope, (acc.get(item.scope) ?? 0) + 1)
                            return acc
                        }, new Map<RemoteVersionKey, number>())
                    ).map(([scope, count]) => ({ scope, count })),
                })

                setFailedPersistTasks((prev) => {
                    const merged = [...prev]
                    for (const failed of stillFailed) {
                        const idx = merged.findIndex((item) => item.id === failed.id)
                        if (idx >= 0) {
                            merged[idx] = failed
                        } else {
                            merged.push(failed)
                        }
                    }
                    return merged
                })

                const nextReasonState: Partial<Record<RemoteVersionKey, RetryReasonCode[]>> = {}
                for (const [scope, reasons] of failedReasons.entries()) {
                    nextReasonState[scope] = Array.from(reasons)
                }
                setLastRetryReasons(nextReasonState)

                if (stillFailed.length === 0) {
                    setHasPendingSync(false)
                    const successLabels = Array.from(succeededScopes).map(scopeLabel)
                    const summary = successLabels.length > 0 ? ` (${successLabels.join(', ')})` : ''
                    showToast(`미동기화 변경사항을 저장했어요.${summary}`)
                    setLastRetryReasons({})
                    return
                }

                setHasPendingSync(true)
                const failedLabels = Array.from(failedScopes).map(scopeLabel)
                const failedSummary = failedLabels.length > 0 ? ` (${failedLabels.join(', ')})` : ''
                let conflictCount = 0
                let saveFailedCount = 0
                for (const reasons of failedReasons.values()) {
                    if (reasons.has('conflict')) conflictCount += 1
                    if (reasons.has('save-failed')) saveFailedCount += 1
                }
                const reasonParts: string[] = []
                if (conflictCount > 0) reasonParts.push(`충돌 ${conflictCount}범위`)
                if (saveFailedCount > 0) reasonParts.push(`저장오류 ${saveFailedCount}범위`)
                const reasonSuffix = reasonParts.length > 0 ? ` (${reasonParts.join(' · ')})` : ''
                showToast(`재시도 후 ${stillFailed.length}건이 남았어요.${failedSummary}${reasonSuffix}`)
            } finally {
                setIsRetryingPersist(false)
                setRetryProgress(null)
            }
        })()
    }, [failedPersistTasks, conflictPreferredScopes, isRetryingPersist])

    const getScopesByReasons = useCallback((targets: RetryReasonCode[]): RemoteVersionKey[] => {
        const targetSet = new Set<RetryReasonCode>(targets)
        return Object.entries(lastRetryReasons)
            .filter(([, codes]) => (codes ?? []).some((code) => targetSet.has(code)))
            .map(([scope]) => scope as RemoteVersionKey)
    }, [lastRetryReasons])

    const handleUseRemoteData = useCallback(() => {
        setShowSyncConflictModal(false)
        setConflictVersionDiffs({})
        setConflictCountDiffs({})
        setConflictRemoteUpdatedAt(null)
        setFailedPersistTasks([])
        setLastRetryReasons({})
        setLastRetryResult(null)
        setHasPendingSync(false)
        void hydrateData()
            .then(() => showToast('원격 데이터로 동기화했어요.'))
            .catch(() => showToast('원격 데이터를 불러오지 못했어요.'))
    }, [hydrateData])

    const handleRetryMineAfterSync = useCallback(() => {
        if (rememberConflictPolicy) {
            setConflictPreferredScopes((prev) => {
                const next = new Set<RemoteVersionKey>(prev)
                const selected = new Set<RemoteVersionKey>(selectedConflictKeys)
                for (const key of conflictKeys) {
                    if (selected.has(key)) next.add(key)
                    else next.delete(key)
                }
                return Array.from(next)
            })
        }
        setShowSyncConflictModal(false)
        setConflictVersionDiffs({})
        setConflictCountDiffs({})
        setConflictRemoteUpdatedAt(null)
        void hydrateData()
            .then(() => {
                retryFailedPersistTasks(selectedConflictKeys)
            })
            .catch(() => {
                showToast('동기화 후 재시도에 실패했어요.')
            })
    }, [hydrateData, retryFailedPersistTasks, selectedConflictKeys, conflictKeys, rememberConflictPolicy])

    const toggleConflictKey = useCallback((key: RemoteVersionKey) => {
        setSelectedConflictKeys((prev) => {
            if (prev.includes(key)) {
                return prev.filter((item) => item !== key)
            }
            return [...prev, key]
        })
    }, [])

    const selectRecommendedConflictKeys = useCallback(() => {
        setSelectedConflictKeys(getDefaultSelectedConflictKeys(conflictKeys, conflictPreferredScopes))
    }, [conflictKeys, conflictPreferredScopes])

    const selectAllConflictKeys = useCallback(() => {
        setSelectedConflictKeys(conflictKeys)
    }, [conflictKeys])

    const clearConflictKeySelection = useCallback(() => {
        setSelectedConflictKeys([])
    }, [])

    const {
        handleSaveTransaction,
        handleDeleteTransaction,
        handleTransactionArchive,
        handleBulkImport,
        handleSaveStockTrade,
        handleDeleteStockTrade,
        handleBudgetsChange,
        handleRecurringSave,
        handleSubscriptionsChange,
        handleGoalsChange,
        handleApplyRecurring,
        handleSavePaymentMethods,
        handleSaveTemplates,
        handleSaveAutoCategoryRules,
        handleRenameTag,
        handleDeleteTag,
        handleSaveHiddenWidgets,
        handleSaveCategories,
        handleAddWatchTicker,
        handleRemoveWatchTicker,
        handleAddMemo,
        handleUpdateMemo,
        handleDeleteMemo,
        handleTogglePin,
        handleBulkDeleteTransactions,
        handleBulkEditTransactions,
    } = useAppHandlers({
        transactions,
        editingTransaction,
        editingTrade,
        yearMonth,
        persist,
        setTransactions,
        setStockTrades,
        setBudgets,
        setRecurring,
        setSubscriptions,
        setGoals,
        setMemos,
        setStockWatchlist,
        setCustomExpenseCategories,
        setCustomIncomeCategories,
        setUserPaymentMethods,
        setTransactionTemplates,
        setAutoCategoryRules,
        setHiddenWidgets,
        dispatchUI,
    })

    // 앱 로드 시 오늘 날짜 기준 정기 항목 자동 감지
    useEffect(() => {
        if (!authReady || isSyncing || autoApplyCheckedRef.current) return
        if (recurring.length === 0) return
        autoApplyCheckedRef.current = true

        const today = new Date()
        const todayDay = today.getDate()
        const todayYM = getYearMonth(today)

        const pending = recurring.filter(
            (r) => r.lastAppliedMonth !== todayYM && r.dayOfMonth <= todayDay
        )
        if (pending.length === 0) return

        if (autoApplyMode === 'always') {
            void handleApplyRecurring(pending, todayYM)
                .then(() => showToast(`정기 항목 ${pending.length}건이 자동 등록되었습니다.`))
                .catch(() => showToast('정기 항목 자동 등록에 실패했어요.'))
            return
        }

        if (autoApplyMode === 'never') {
            return
        }

        setAutoApplyPending(pending)
        setShowAutoApplyModal(true)
    }, [authReady, isSyncing, recurring, autoApplyMode, handleApplyRecurring])

    const prevMonth = useCallback(() => {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])
    const nextMonth = useCallback(() => {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])
    const openTransactionsWithBilling = useCallback((billing: 'current' | 'next') => {
        localStorage.setItem(FILTER_TYPE_KEY, 'expense')
        localStorage.setItem(METHOD_FILTER_KEY, 'credit')
        localStorage.setItem(BILLING_FILTER_KEY, billing)
        localStorage.removeItem(STATEMENT_MONTH_FILTER_KEY)
        setMode('ledger')
        setTab('transactions')
        showToast(billing === 'current' ? '카드 이번 청구 내역만 표시합니다.' : '카드 다음 청구 내역만 표시합니다.')
    }, [])
    const isCurrentMonth = () => {
        const now = new Date()
        return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
    }

    const { monthIncome, monthExpense, monthBalance } = useMemo(() => {
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
            monthIncome: income,
            monthExpense: expense,
            monthBalance: opening + income - expense,
        }
    }, [transactions, yearMonth])
    const monthCardDue = useMemo(
        () => calculateCardDueAmount(transactions, yearMonth, cardBillingDay ?? 25),
        [transactions, yearMonth, cardBillingDay]
    )
    const nextMonthCardDue = useMemo(
        () => calculateCardDueAmount(transactions, shiftYM(yearMonth, 1), cardBillingDay ?? 25),
        [transactions, yearMonth, cardBillingDay]
    )
    const stockTickerCount = useMemo(() => new Set(stockTrades.map((t) => t.ticker)).size, [stockTrades])
    const retryReasonTotals = useMemo(() => getRetryReasonTotals(lastRetryReasons), [lastRetryReasons])
    const syncStatus = useMemo(() => {
        if (!isOnline && hasPendingSync) {
            return { title: '오프라인이며 동기화 대기 항목이 있어요', label: '오프라인+대기' }
        }
        if (!isOnline) {
            return { title: '오프라인 상태입니다', label: '오프라인' }
        }
        return { title: '저장되지 않은 변경사항이 있어요', label: '미동기화' }
    }, [isOnline, hasPendingSync])

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
                            {/* 오프라인 / 미동기화 상태 배지 */}
                            {(!isOnline || hasPendingSync) && (
                                <div
                                    title={syncStatus.title}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2C2C2E] border border-white/6"
                                >
                                    {!isOnline
                                        ? <WifiOff size={11} className="text-[#F25260]" />
                                        : <CloudOff size={11} className="text-[#F5BE3A]" />
                                    }
                                    <span className="text-[10px] font-bold text-[#8B95A1]">
                                        {syncStatus.label}
                                    </span>
                                </div>
                            )}
                            {user ? (
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setShowUserMenu((v) => !v)}
                                        onMouseEnter={prefetchImportUtilities}
                                        onFocus={prefetchImportUtilities}
                                        onTouchStart={prefetchImportUtilities}
                                        aria-label="메뉴"
                                        className="w-8 h-8 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] transition-colors border border-[rgba(255,255,255,0.06)] flex items-center justify-center overflow-hidden"
                                    >
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="text-[12px] font-bold text-[#79B2FF]">
                                                {(user.email?.[0] ?? 'U').toUpperCase()}
                                            </span>
                                        )}
                                    </button>
                                    {showUserMenu && (
                                        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-2xl bg-[#1C1C1E] border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-black/40 overflow-hidden">
                                            <div className="px-3.5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                                                <p className="text-[10px] font-semibold text-[#4E5968] uppercase tracking-wide mb-0.5">로그인 계정</p>
                                                <p className="text-[12px] font-semibold text-[#C8D1DC] truncate">{user.email ?? '로그인 사용자'}</p>
                                            </div>
                                            <div className="p-1">
                                                {activeMode === 'ledger' && (
                                                    <>
                                                        <button
                                                            onClick={() => { dispatchUI({ type: 'SET_IMPORT', value: true }); setShowUserMenu(false) }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#C8D1DC] hover:bg-[#2C2C2E] transition-colors text-left"
                                                        >
                                                            <FileDown size={14} className="text-[#8B95A1]" />
                                                            가져오기
                                                        </button>
                                                        <button
                                                            onClick={() => { dispatchUI({ type: 'SET_PAYMENT_METHODS', value: true }); setShowUserMenu(false) }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#C8D1DC] hover:bg-[#2C2C2E] transition-colors text-left"
                                                        >
                                                            <CreditCard size={14} className="text-[#8B95A1]" />
                                                            결제수단 관리
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowAutoCategoryRuleModal(true); setShowUserMenu(false) }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#C8D1DC] hover:bg-[#2C2C2E] transition-colors text-left"
                                                        >
                                                            <Target size={14} className="text-[#8B95A1]" />
                                                            자동 분류 규칙
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setShowUserMenu(false)
                                                        dispatchUI({ type: 'OPEN_CONFIRM', message: '로그아웃 하시겠어요?', onConfirm: handleLogout, confirmLabel: '로그아웃', confirmVariant: 'danger' })
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#F25260] hover:bg-[#F25260]/10 transition-colors text-left"
                                                >
                                                    <LogOut size={14} />
                                                    로그아웃
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {activeMode === 'ledger' && (
                                        <button
                                            onClick={() => dispatchUI({ type: 'SET_IMPORT', value: true })}
                                            onMouseEnter={prefetchImportUtilities}
                                            onFocus={prefetchImportUtilities}
                                            onTouchStart={prefetchImportUtilities}
                                            aria-label="거래내역 가져오기"
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#8B95A1] bg-[#1C1C1E] hover:bg-[#2C2C2E] transition-colors border border-[rgba(255,255,255,0.06)]"
                                        >
                                            <FileDown size={12} />
                                        </button>
                                    )}
                                    <button aria-label="로그인 모달 열기" onClick={() => setShowAuthModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#2ACF6A] bg-[#2ACF6A]/10 hover:bg-[#2ACF6A]/20 transition-colors border border-[#2ACF6A]/15">
                                        로그인
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] p-1.5">
                        <button
                            onClick={() => {
                                setMode('ledger')
                                if (tab === 'stocks') setTab('home')
                            }}
                            onMouseEnter={() => prefetchMode('ledger')}
                            onFocus={() => prefetchMode('ledger')}
                            onTouchStart={() => prefetchMode('ledger')}
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
                            onMouseEnter={() => prefetchMode('stocks')}
                            onFocus={() => prefetchMode('stocks')}
                            onTouchStart={() => prefetchMode('stocks')}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${activeMode === 'stocks' ? 'bg-[#F5BE3A] text-[#111111]' : 'text-[#8B95A1] hover:bg-white/5'}`}
                        >
                            주식
                        </button>
                    </div>

                    {activeMode === 'ledger' ? (
                        <>
                            <div className="flex items-center justify-center gap-3 mt-3">
                                <button aria-label="이전 달 보기" onClick={prevMonth} className="w-8 h-8 rounded-full bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform">
                                    <ChevronLeft size={16} className="text-[#8B95A1]" />
                                </button>
                                <button aria-label="이번 달로 이동" onClick={() => setCurrentDate(new Date())} className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all ${isCurrentMonth() ? 'bg-white text-[#111111]' : 'bg-[#1C1C1E] text-[#8B95A1] border border-[rgba(255,255,255,0.06)]'}`}>
                                    {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                                </button>
                                <button aria-label="다음 달 보기" onClick={nextMonth} className="w-8 h-8 rounded-full bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform">
                                    <ChevronRight size={16} className="text-[#8B95A1]" />
                                </button>
                            </div>

                            {(monthIncome > 0 || monthExpense > 0) && (
                                <div className="mt-3 pb-1 space-y-1.5">
                                    <div className="flex items-center justify-center gap-4">
                                        <span className="text-xs font-semibold text-[#2ACF6A] num">+{monthIncome.toLocaleString()}</span>
                                        <div className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.12)]" />
                                        <span className="text-xs font-semibold text-[#F25260] num">-{monthExpense.toLocaleString()}</span>
                                        <div className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.12)]" />
                                        <span className={`text-xs font-bold num ${monthBalance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                                            {monthBalance.toLocaleString()}원
                                        </span>
                                    </div>

                                    {(monthCardDue > 0 || nextMonthCardDue > 0) && (
                                        <div className="flex items-center justify-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => openTransactionsWithBilling('current')}
                                                aria-label="카드 이번 청구 내역 필터 보기"
                                                className="text-[10px] font-bold text-[#F5BE3A] num hover:text-[#FFD66A] transition-colors px-2 py-0.5 rounded-full bg-[#F5BE3A]/12"
                                                title="카드 이번 청구 내역 보기"
                                            >
                                                이번청구 {monthCardDue.toLocaleString()}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openTransactionsWithBilling('next')}
                                                aria-label="카드 다음 청구 내역 필터 보기"
                                                className="text-[10px] font-bold text-[#79B2FF] num hover:text-[#A9CCFF] transition-colors px-2 py-0.5 rounded-full bg-[#3D8EF8]/12"
                                                title="카드 다음 청구 내역 보기"
                                            >
                                                다음청구 {nextMonthCardDue.toLocaleString()}
                                            </button>
                                        </div>
                                    )}
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

                    {failedPersistTasks.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-[#2B1E1E] border border-[#F25260]/25 px-3 py-2.5 flex items-center gap-3">
                            <CloudOff size={14} className="text-[#F25260] shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-[#FFD5D9]">저장 실패 {failedPersistTasks.length}건</p>
                                <p className="text-[10px] text-[#F5AAB1] truncate">네트워크 복구 후 다시 저장해주세요.</p>
                                {Object.keys(lastRetryReasons).length > 0 && (
                                    <p className="text-[10px] text-[#F0B7BE] mt-0.5 truncate">
                                        {`최근 원인: 충돌 ${retryReasonTotals.conflict}범위 · 저장오류 ${retryReasonTotals.saveFailed}범위`}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {Object.keys(lastRetryReasons).length > 0 && (
                                    <button
                                        onClick={() => setShowSyncRecoveryGuideModal(true)}
                                        className="px-2 py-1.5 rounded-lg bg-[#2C2C2E] text-[#C8D1DC] text-[11px] font-bold border border-white/10"
                                    >
                                        가이드
                                    </button>
                                )}
                                <button
                                    onClick={() => retryFailedPersistTasks(undefined, 'all')}
                                    disabled={isRetryingPersist}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#F25260] disabled:opacity-40 text-white text-[11px] font-bold hover:bg-[#FF6E7A] transition-colors"
                                >
                                    {isRetryingPersist ? '재시도 중...' : '전체 재시도'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="h-px bg-white/4 mx-5" />
            </header>

            <main className="max-w-lg mx-auto px-4 py-4">
                {activeMode === 'ledger' && (
                    <Suspense fallback={<WorkspaceSkeleton mode="ledger" />}>
                        <LedgerWorkspace
                            activeTab={activeTab}
                            transactions={transactions}
                            budgets={budgets}
                            recurring={recurring}
                            stockTrades={stockTrades}
                            subscriptions={subscriptions}
                            goals={goals}
                            settingsVersion={settingsVersion + settingsSyncTick}
                            yearMonth={yearMonth}
                            customExpenseCategories={customExpenseCategories}
                            userPaymentMethods={userPaymentMethods}
                            memos={memos}
                            memoAddTrigger={memoAddTrigger}
                            subscriptionAddTrigger={subscriptionAddTrigger}
                            goalAddTrigger={goalAddTrigger}
                            hiddenWidgets={hiddenWidgets}
                            onBudgetsChange={handleBudgetsChange}
                            onRecurringSave={handleRecurringSave}
                            onApplyRecurring={handleApplyRecurring}
                            onSubscriptionsChange={handleSubscriptionsChange}
                            onGoalsChange={handleGoalsChange}
                            onOpenCategoryModal={() => dispatchUI({ type: 'SET_CATEGORY', value: true })}
                            onOpenPaymentMethodsModal={() => dispatchUI({ type: 'SET_PAYMENT_METHODS', value: true })}
                            onTransactionEdit={(t) => dispatchUI({ type: 'OPEN_TX_MODAL', editing: t })}
                            onTransactionDelete={handleDeleteTransaction}
                            onBulkDeleteTransactions={handleBulkDeleteTransactions}
                            onBulkEditTransactions={handleBulkEditTransactions}
                            onTransactionArchive={handleTransactionArchive}
                            onMemoAdd={handleAddMemo}
                            onMemoUpdate={handleUpdateMemo}
                            onMemoDelete={handleDeleteMemo}
                            onMemoTogglePin={handleTogglePin}
                            onOpenTagManager={() => setShowTagManagerModal(true)}
                            onOpenWidgetSettings={() => setShowWidgetSettings(true)}
                        />
                    </Suspense>
                )}
                {activeTab === 'stocks' && (
                    <Suspense fallback={<WorkspaceSkeleton mode="stocks" />}>
                        <StocksWorkspace
                            stockSubTab={stockSubTab}
                            stockTrades={stockTrades}
                            stockWatchlist={stockWatchlist}
                            onStockSubTabChange={handleStockSubTabChange}
                            onTradeEdit={(t) => dispatchUI({ type: 'OPEN_STOCK_MODAL', editing: t })}
                            onTradeDelete={handleDeleteStockTrade}
                            onWatchAdd={handleAddWatchTicker}
                            onWatchRemove={handleRemoveWatchTicker}
                        />
                    </Suspense>
                )}
            </main>

            {/* Speed Dial 백드롭 */}
            {fabExpanded && (
                <div
                    className="fixed inset-0 z-[29] pointer-events-auto"
                    onClick={() => setFabExpanded(false)}
                />
            )}

            <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
                <div className="max-w-lg mx-auto relative h-0">
                    {showFAB && (() => {
                        const isSpeedDialTab = activeMode === 'ledger' && !(['memos', 'subscriptions', 'goals'] as Tab[]).includes(activeTab)
                        return (
                            <>
                                {/* Speed Dial: 수입 버튼 */}
                                {fabExpanded && isSpeedDialTab && (
                                    <button
                                        className="speed-dial-item pointer-events-auto absolute right-5 bottom-fab-dial-2 w-10 h-10 rounded-full shadow-xl flex flex-col items-center justify-center gap-0.5 font-bold text-[10px] text-white transition-all active:scale-95"
                                        style={{ backgroundColor: '#1A8C4E', animationDelay: '0.07s', boxShadow: '0 4px 16px rgba(26,140,78,0.45)' }}
                                        onClick={() => { setTxInitialType('income'); setFabExpanded(false); dispatchUI({ type: 'OPEN_TX_MODAL' }) }}
                                        aria-label="수입 추가"
                                    >
                                        <span className="text-sm leading-none">↑</span>
                                        <span>수입</span>
                                    </button>
                                )}
                                {/* Speed Dial: 지출 버튼 */}
                                {fabExpanded && isSpeedDialTab && (
                                    <button
                                        className="speed-dial-item pointer-events-auto absolute right-5 bottom-fab-dial-1 w-10 h-10 rounded-full shadow-xl flex flex-col items-center justify-center gap-0.5 font-bold text-[10px] text-white transition-all active:scale-95"
                                        style={{ backgroundColor: '#C0394A', animationDelay: '0s', boxShadow: '0 4px 16px rgba(192,57,74,0.45)' }}
                                        onClick={() => { setTxInitialType('expense'); setFabExpanded(false); dispatchUI({ type: 'OPEN_TX_MODAL' }) }}
                                        aria-label="지출 추가"
                                    >
                                        <span className="text-sm leading-none">↓</span>
                                        <span>지출</span>
                                    </button>
                                )}
                                {/* 메인 FAB */}
                                <button
                                    onMouseEnter={prefetchFabModal}
                                    onFocus={prefetchFabModal}
                                    onTouchStart={prefetchFabModal}
                                    onClick={() => {
                                        if (activeTab === 'stocks' && (stockSubTab === 'portfolio' || stockSubTab === 'trades')) {
                                            dispatchUI({ type: 'OPEN_STOCK_MODAL' })
                                        } else if (activeTab === 'memos') {
                                            dispatchUI({ type: 'TRIGGER_MEMO' })
                                        } else if (activeTab === 'subscriptions') {
                                            dispatchUI({ type: 'TRIGGER_SUB' })
                                        } else if (activeTab === 'goals') {
                                            dispatchUI({ type: 'TRIGGER_GOAL' })
                                        } else if (isSpeedDialTab) {
                                            setFabExpanded((v) => !v)
                                        } else {
                                            setTxInitialType('expense')
                                            dispatchUI({ type: 'OPEN_TX_MODAL' })
                                        }
                                    }}
                                    aria-label={fabExpanded ? '닫기' : '내역 추가'}
                                    aria-expanded={fabExpanded}
                                    className={`pointer-events-auto absolute right-5 bottom-fab-safe w-12 h-12 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 ${fabExpanded ? 'bg-[#3A3A3C] shadow-black/40' : 'bg-[#3D8EF8] hover:bg-[#5AA0FF] shadow-[#3D8EF8]/30'}`}
                                >
                                    <Plus size={20} className={`transition-transform duration-200 ${fabExpanded ? 'rotate-45' : ''}`} />
                                </button>
                            </>
                        )
                    })()}

                    <button
                        onClick={() => dispatchUI({ type: 'SET_HELP', value: true })}
                        onMouseEnter={prefetchHelp}
                        onFocus={prefetchHelp}
                        onTouchStart={prefetchHelp}
                        aria-label="사용 가이드"
                        className="pointer-events-auto absolute left-5 bottom-fab-safe w-10 h-10 bg-[#1C1C1E] border border-white/10 hover:bg-[#2C2C2E] active:scale-95 text-[#8B95A1] hover:text-white rounded-full flex items-center justify-center transition-all text-sm font-bold"
                    >
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
                onLedgerTabChange={handleLedgerTabChange}
                onStockSubTabChange={handleStockSubTabChange}
                onLedgerTabHover={prefetchLedgerTab}
                onStockSubTabHover={prefetchStockSubTab}
            />

            {toastMsg && (
                <div className={`fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm ${toastAction ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                    <div className="flex items-center gap-3 bg-[#1C1C1E] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 shadow-xl">
                        {toastVariant === 'success' && <CheckCircle2 size={16} className="text-[#2ACF6A] shrink-0" />}
                        {toastVariant === 'warning' && <AlertTriangle size={16} className="text-[#F5BE3A] shrink-0" />}
                        {toastVariant === 'error' && <AlertTriangle size={16} className="text-[#F25260] shrink-0" />}
                        {toastVariant === 'info' && <Info size={16} className="text-[#3D8EF8] shrink-0" />}
                        <p className="text-sm font-semibold text-white whitespace-pre-line flex-1">{toastMsg}</p>
                        {toastAction && (
                            <button
                                onClick={() => { toastAction.onClick(); setToastMsg(null); setToastAction(null) }}
                                className="shrink-0 text-[13px] font-bold text-[#3D8EF8] hover:text-[#79B2FF] transition-colors px-2 py-1 rounded-lg hover:bg-[#3D8EF8]/10"
                            >
                                {toastAction.label}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showStockModal && (
                <Suspense fallback={null}>
                    <StockTradeModal
                        trade={editingTrade}
                        onSave={handleSaveStockTrade}
                        onClose={() => dispatchUI({ type: 'CLOSE_STOCK_MODAL' })}
                    />
                </Suspense>
            )}
            {showHelp && (
                <Suspense fallback={null}>
                    <HelpModal onClose={() => dispatchUI({ type: 'SET_HELP', value: false })} />
                </Suspense>
            )}
            {showImport && (
                <Suspense fallback={null}>
                    <ImportModal
                        existingTransactions={transactions}
                        onImport={handleBulkImport}
                        onClose={() => dispatchUI({ type: 'SET_IMPORT', value: false })}
                    />
                </Suspense>
            )}
            {showModal && (
                <Suspense fallback={null}>
                    <TransactionModal
                        transaction={editingTransaction}
                        onSave={handleSaveTransaction}
                        onClose={() => { dispatchUI({ type: 'CLOSE_TX_MODAL' }); setFabExpanded(false) }}
                        customExpenseCategories={customExpenseCategories}
                        customIncomeCategories={customIncomeCategories}
                        userPaymentMethods={userPaymentMethods}
                        transactionTemplates={transactionTemplates}
                        onSaveTemplates={handleSaveTemplates}
                        onOpenPaymentMethodsModal={() => dispatchUI({ type: 'SET_PAYMENT_METHODS', value: true })}
                        autoCategoryRules={autoCategoryRules}
                        initialType={editingTransaction ? undefined : txInitialType}
                    />
                </Suspense>
            )}
            {showCategoryModal && (
                <Suspense fallback={null}>
                    <CategoryModal
                        customExpenseCategories={customExpenseCategories}
                        customIncomeCategories={customIncomeCategories}
                        onSave={handleSaveCategories}
                        onClose={() => dispatchUI({ type: 'SET_CATEGORY', value: false })}
                    />
                </Suspense>
            )}
            {showPaymentMethodsModal && (
                <Suspense fallback={null}>
                    <PaymentMethodsModal
                        userPaymentMethods={userPaymentMethods}
                        onSave={handleSavePaymentMethods}
                        onClose={() => dispatchUI({ type: 'SET_PAYMENT_METHODS', value: false })}
                    />
                </Suspense>
            )}
            {showAutoCategoryRuleModal && (
                <Suspense fallback={null}>
                    <AutoCategoryRuleModal
                        rules={autoCategoryRules}
                        customExpenseCategories={customExpenseCategories}
                        customIncomeCategories={customIncomeCategories}
                        onSave={handleSaveAutoCategoryRules}
                        onClose={() => setShowAutoCategoryRuleModal(false)}
                    />
                </Suspense>
            )}
            {showTagManagerModal && (
                <Suspense fallback={null}>
                    <TagManagerModal
                        transactions={transactions}
                        onRenameTag={handleRenameTag}
                        onDeleteTag={handleDeleteTag}
                        onClose={() => setShowTagManagerModal(false)}
                    />
                </Suspense>
            )}
            {showWidgetSettings && (
                <Suspense fallback={null}>
                    <DashboardWidgetSettings
                        hiddenWidgets={hiddenWidgets}
                        onSave={handleSaveHiddenWidgets}
                        onClose={() => setShowWidgetSettings(false)}
                    />
                </Suspense>
            )}

            {showMergeModal && (
                <Suspense fallback={null}>
                    <MergeLocalDataModal onConfirm={handleMergeConfirm} onCancel={handleMergeCancel} counts={localDataCounts} />
                </Suspense>
            )}

            {showSyncConflictModal && (
                <Suspense fallback={null}>
                    <SyncConflictModal
                        conflictKeys={conflictKeys}
                        selectedKeys={selectedConflictKeys}
                        versionDiffs={conflictVersionDiffs}
                        countDiffs={conflictCountDiffs}
                        remoteUpdatedAt={conflictRemoteUpdatedAt}
                        rememberPolicy={rememberConflictPolicy}
                        onToggleKey={(key) => toggleConflictKey(key as RemoteVersionKey)}
                        onSelectRecommended={selectRecommendedConflictKeys}
                        onSelectAll={selectAllConflictKeys}
                        onClearSelection={clearConflictKeySelection}
                        onToggleRememberPolicy={setRememberConflictPolicy}
                        onUseRemote={handleUseRemoteData}
                        onRetryMine={handleRetryMineAfterSync}
                        onClose={() => {
                            setShowSyncConflictModal(false)
                            setConflictVersionDiffs({})
                            setConflictCountDiffs({})
                            setConflictRemoteUpdatedAt(null)
                        }}
                    />
                </Suspense>
            )}

            {showSyncRecoveryGuideModal && (
                <Suspense fallback={null}>
                    <SyncRecoveryGuideModal
                        reasons={Array.from(new Set(Object.values(lastRetryReasons).flatMap((codes) => codes ?? [])))}
                        onOpenConflict={() => {
                            setShowSyncRecoveryGuideModal(false)
                            if (conflictKeys.length > 0) {
                                setShowSyncConflictModal(true)
                            } else {
                                showToast('현재 충돌 항목이 없어요.')
                            }
                        }}
                        onRetryNow={() => {
                            retryFailedPersistTasks(undefined, 'all')
                        }}
                        onRetryConflictOnly={() => {
                            const scopes = getScopesByReasons(['conflict'])
                            if (scopes.length === 0) {
                                showToast('충돌 항목이 없어요.')
                                return
                            }
                            retryFailedPersistTasks(scopes, 'conflict-only')
                        }}
                        onRetrySaveFailedOnly={() => {
                            const scopes = getScopesByReasons(['save-failed'])
                            if (scopes.length === 0) {
                                showToast('저장오류 항목이 없어요.')
                                return
                            }
                            retryFailedPersistTasks(scopes, 'save-failed-only')
                        }}
                        isRetrying={isRetryingPersist}
                        retryProgress={retryProgress}
                        retryResult={lastRetryResult
                            ? {
                                attempted: lastRetryResult.attempted,
                                succeeded: lastRetryResult.succeeded,
                                failed: lastRetryResult.failed,
                                mode: lastRetryResult.mode,
                                finishedAt: lastRetryResult.finishedAt,
                                failedScopeSummary: lastRetryResult.failedByScope
                                    .map((entry) => `${scopeLabel(entry.scope)} ${entry.count}건`)
                                    .join(', '),
                            }
                            : null}
                        onClose={() => setShowSyncRecoveryGuideModal(false)}
                    />
                </Suspense>
            )}

            {showAutoApplyModal && autoApplyPending.length > 0 && (
                <Suspense fallback={null}>
                    <AutoApplyRecurringModal
                        pending={autoApplyPending}
                        mode={autoApplyMode}
                        onModeChange={setAutoApplyMode}
                        onConfirm={async () => {
                            const todayYM = getYearMonth(new Date())
                            setShowAutoApplyModal(false)
                            await handleApplyRecurring(autoApplyPending, todayYM)
                            showToast(`정기 항목 ${autoApplyPending.length}건이 등록되었습니다.`)
                        }}
                        onDismiss={() => setShowAutoApplyModal(false)}
                    />
                </Suspense>
            )}

            {showAuthModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
                    <div className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 id="auth-modal-title" className="text-white text-base font-bold">계정 로그인</h3>
                            <button aria-label="로그인 모달 닫기" onClick={() => setShowAuthModal(false)} className="text-xs font-bold text-[#8B95A1]">닫기</button>
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
                            <input aria-label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full px-3 py-2 rounded-xl bg-[#1E2236] border border-white/10 text-sm text-white placeholder:text-[#8B95A1] outline-none focus:border-[#3D8EF8]" />
                            <input aria-label="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 (6자 이상)" className="w-full px-3 py-2 rounded-xl bg-[#1E2236] border border-white/10 text-sm text-white placeholder:text-[#8B95A1] outline-none focus:border-[#3D8EF8]" />
                        </div>

                        <button onClick={handleEmailAuth} disabled={authBusy} className="w-full py-2.5 rounded-xl bg-[#3D8EF8] disabled:opacity-50 text-white text-sm font-bold">
                            {authBusy ? '처리 중...' : authMode === 'signup' ? '이메일 회원가입' : '이메일 로그인'}
                        </button>

                        <button onClick={handleGoogleLogin} disabled={authBusy} className="w-full py-2.5 rounded-xl bg-[#09f]/80 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">
                            {authBusy ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <GoogleIcon />}
                            {authBusy ? '처리 중...' : '구글 로그인'}
                        </button>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-70" onClick={() => dispatchUI({ type: 'CLOSE_CONFIRM' })}>
                    <div className="bg-[#1C1C1E] rounded-3xl p-6 mx-4 max-w-xs w-full border border-white/8" onClick={(e) => e.stopPropagation()}>
                        <p className="text-white font-semibold text-center text-[15px] mb-6">{confirmModal.message}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => dispatchUI({ type: 'CLOSE_CONFIRM' })}
                                className="flex-1 py-3 rounded-2xl bg-[#2C2C2E] text-[#8B95A1] font-bold text-sm"
                            >취소</button>
                            <button
                                onClick={() => { confirmModal.onConfirm(); dispatchUI({ type: 'CLOSE_CONFIRM' }) }}
                                className={`flex-1 py-3 rounded-2xl font-bold text-sm ${confirmModal.confirmVariant === 'primary' ? 'bg-[#3D8EF8]/20 text-[#3D8EF8]' : 'bg-[#F25260]/20 text-[#F25260]'}`}
                            >{confirmModal.confirmLabel ?? '삭제'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
