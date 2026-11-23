import {
    Suspense,
    lazy,
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
    useReducer,
} from "react";
import {useRegisterSW} from "virtual:pwa-register/react";
import {
    ArrowDownLeft,
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    Plus,
    LayoutDashboard,
    List,
    BarChart2,
    StickyNote,
    LayoutGrid,
    RefreshCw,
    CreditCard,
    Target,
    WifiOff,
    CloudOff,
} from "lucide-react";
import type {
    AutoCategoryRule,
    DashboardWidgetId,
    Transaction,
    Memo,
    Budget,
    RecurringTransaction,
    Subscription,
    SavingsGoal,
    UserPaymentMethod,
    TransactionTemplate,
    TransactionType,
} from "./types";
import type {Tab} from "./types/navigation";
import {loadAllData, loadSettings, resetAllData} from "./lib/storage";
import type {AppDataSnapshot, RemoteVersionKey} from "./lib/storage";
import {getDefaultSelectedConflictKeys, scopeLabel, useSyncPersistence} from "./hooks/useSyncPersistence";
import {useRecurringAutoApply} from "./hooks/useRecurringAutoApply";
import {calculateCardDueAmount} from "./lib/cardBilling";
import {shiftYM, toYearMonth} from "./lib/format";
import {usePWAInstall} from "./hooks/usePWAInstall";
import {consumeEntryShortcut} from "./lib/pwaShortcuts";
import {useAuthSync} from "./hooks/useAuthSync";
import {useAppHandlers} from "./hooks/useAppHandlers";
import type {UIAction} from "./hooks/useAppHandlers.types";
import {showToast} from "./lib/toast";
import {ToastHost} from "./components/layout/ToastHost";
import {HeaderMenu} from "./components/layout/HeaderMenu";
import {SyncStatusBar} from "./components/layout/SyncStatusBar";
import BrandMark from "./components/ui/BrandMark";
import ThemeToggle from "./components/layout/ThemeToggle";
import BottomNavigation from "./components/layout/BottomNavigation";
import WorkspaceSkeleton from "./components/layout/WorkspaceSkeleton";
import { NotificationCenter } from "./components/NotificationCenter";
import InstallOffer from "./components/InstallOffer";

const TransactionModal = lazy(() => import("./components/TransactionModal"));
const ImportModal = lazy(() => import("./components/ImportModal"));
const BackupModal = lazy(() => import("./components/BackupModal"));
const HelpModal = lazy(() => import("./components/HelpModal"));
const UsageInsightsModal = lazy(() => import("./components/UsageInsightsModal"));
const CategoryModal = lazy(() => import("./components/CategoryModal"));
const PaymentMethodsModal = lazy(
    () => import("./components/PaymentMethodsModal"),
);
const LedgerWorkspace = lazy(
    () => import("./components/workspaces/LedgerWorkspace"),
);
const MergeLocalDataModal = lazy(
    () => import("./components/MergeLocalDataModal"),
);
const AutoApplyRecurringModal = lazy(
    () => import("./components/AutoApplyRecurringModal"),
);
const AutoApplyResultModal = lazy(
    () => import("./components/AutoApplyResultModal"),
);
const SyncConflictModal = lazy(() => import("./components/SyncConflictModal"));
const SyncRecoveryGuideModal = lazy(
    () => import("./components/SyncRecoveryGuideModal"),
);
const AutoCategoryRuleModal = lazy(
    () => import("./components/AutoCategoryRuleModal"),
);
const TagManagerModal = lazy(() => import("./components/TagManagerModal"));
const DashboardWidgetSettings = lazy(
    () => import("./components/DashboardWidgetSettings"),
);
const ResetAllDataModal = lazy(
    () => import("./components/ResetAllDataModal"),
);

const DATA_LOAD_TIMEOUT_MS = 9000;
const FILTER_TYPE_KEY = "hb_tx_type_filter";
const METHOD_FILTER_KEY = "hb_tx_method_filter";
const BILLING_FILTER_KEY = "hb_tx_billing_filter";
const STATEMENT_MONTH_FILTER_KEY = "hb_tx_statement_month_filter";

// 신규 유저 기본 숨김 위젯 (활성화 빈도 낮은 항목)
const DEFAULT_HIDDEN_WIDGETS: DashboardWidgetId[] = [
    "timeofday-spending",
    "weekly-comparison",
    "spending-pace",
    "spending-spike",
    "spending-savings",
];







const LEDGER_TABS = [
    {id: "home" as Tab, label: "홈", Icon: LayoutDashboard},
    {id: "transactions" as Tab, label: "내역", Icon: List},
    {id: "analytics" as Tab, label: "분석", Icon: BarChart2},
];

// 하단 메뉴에서는 '더보기' 하나로 묶고, 화면 위 전환 버튼으로 오간다
const MORE_TABS = [
    {id: "goals" as Tab, label: "목표", Icon: Target},
    {id: "subscriptions" as Tab, label: "구독", Icon: CreditCard},
    {id: "memos" as Tab, label: "메모", Icon: StickyNote},
];
const MORE_TAB_IDS = MORE_TABS.map((t) => t.id);

// ── UI 전용 상태 (모달 열림/닫힘, 트리거 카운터) ──────────────────────────────
interface UIState {
    showModal: boolean;
    editingTransaction: Transaction | null;
    showImport: boolean;
    showHelp: boolean;
    showCategoryModal: boolean;
    showPaymentMethodsModal: boolean;
    showResetModal: boolean;
    memoAddTrigger: number;
    subscriptionAddTrigger: number;
    goalAddTrigger: number;
    confirmModal: {
        message: string;
        onConfirm: () => void;
        confirmLabel?: string;
        confirmVariant?: "danger" | "primary";
    } | null;
}


const UI_INIT: UIState = {
    showModal: false,
    editingTransaction: null,
    showImport: false,
    showHelp: false,
    showCategoryModal: false,
    showPaymentMethodsModal: false,
    showResetModal: false,
    memoAddTrigger: 0,
    subscriptionAddTrigger: 0,
    goalAddTrigger: 0,
    confirmModal: null,
};

function uiReducer(state: UIState, action: UIAction): UIState {
    switch (action.type) {
        case "OPEN_TX_MODAL":
            return {
                ...state,
                showModal: true,
                editingTransaction: action.editing ?? null,
            };
        case "CLOSE_TX_MODAL":
            return {...state, showModal: false, editingTransaction: null};
        case "SET_IMPORT":
            return {...state, showImport: action.value};
        case "SET_HELP":
            return {...state, showHelp: action.value};
        case "SET_CATEGORY":
            return {...state, showCategoryModal: action.value};
        case "SET_PAYMENT_METHODS":
            return {...state, showPaymentMethodsModal: action.value};
        case "SET_RESET":
            return {...state, showResetModal: action.value};
        case "TRIGGER_MEMO":
            return {...state, memoAddTrigger: state.memoAddTrigger + 1};
        case "TRIGGER_SUB":
            return {
                ...state,
                subscriptionAddTrigger: state.subscriptionAddTrigger + 1,
            };
        case "TRIGGER_GOAL":
            return {...state, goalAddTrigger: state.goalAddTrigger + 1};
        case "OPEN_CONFIRM":
            return {
                ...state,
                confirmModal: {
                    message: action.message,
                    onConfirm: action.onConfirm,
                    confirmLabel: action.confirmLabel,
                    confirmVariant: action.confirmVariant,
                },
            };
        case "CLOSE_CONFIRM":
            return {...state, confirmModal: null};
    }
}

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4C12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.2 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.4 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.3 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.2-5.9 6.8l6.2 5.2C39.3 36.6 44 31 44 24c0-1.3-.1-2.4-.4-3.5z"
            />
        </svg>
    );
}

export default function App() {
    const swIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onNeedRefresh() {
            updateServiceWorker(true);
        },
        onRegistered(r) {
            if (swIntervalRef.current !== null)
                clearInterval(swIntervalRef.current);
            swIntervalRef.current = setInterval(
                () => r?.update(),
                60 * 60 * 1000,
            );
        },
    });

    const {
        showInstallBanner,
        installOfferMode,
        isIosManualInstall,
        installGuideText,
        deferredPrompt,
        closeInstallBanner,
        handleInstallClick,
        offerInstallAfterSave,
        openInstallGuide,
        canInstall,
    } = usePWAInstall();

    const [tab, setTab] = useState<Tab>(() => {
        const saved = localStorage.getItem("hb_active_tab");
        const valid: Tab[] = [
            "home",
            "transactions",
            "analytics",
            "memos",
            "subscriptions",
            "goals",
        ];
        return valid.includes(saved as Tab) ? (saved as Tab) : "home";
    });
    const [currentDate, setCurrentDate] = useState(new Date());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [cardBillingDay, setCardBillingDay] = useState<number | null>(null);
    const [settingsSyncTick, setSettingsSyncTick] = useState(0);
    const [memos, setMemos] = useState<Memo[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);

    const [customExpenseCategories, setCustomExpenseCategories] = useState<
        string[]
    >([]);
    const [customIncomeCategories, setCustomIncomeCategories] = useState<
        string[]
    >([]);
    const [userPaymentMethods, setUserPaymentMethods] = useState<
        UserPaymentMethod[]
    >([]);
    const [transactionTemplates, setTransactionTemplates] = useState<
        TransactionTemplate[]
    >([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [autoCategoryRules, setAutoCategoryRules] = useState<
        AutoCategoryRule[]
    >([]);
    const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetId[]>(
        DEFAULT_HIDDEN_WIDGETS,
    );
    const [showTagManagerModal, setShowTagManagerModal] = useState(false);
    const [showBackup, setShowBackup] = useState(false);
    const [showUsageInsights, setShowUsageInsights] = useState(false);
    const [showAutoCategoryRuleModal, setShowAutoCategoryRuleModal] =
        useState(false);
    const [showWidgetSettings, setShowWidgetSettings] = useState(false);
    const [fabExpanded, setFabExpanded] = useState(false);
    const [txInitialType, setTxInitialType] =
        useState<TransactionType>("expense");

    // UI 전용 상태: 11개 useState → useReducer 1개로 통합
    const [ui, dispatchUI] = useReducer(uiReducer, UI_INIT);
    const {
        showModal,
        editingTransaction,
        showImport,
        showHelp,
        showCategoryModal,
        showPaymentMethodsModal,
        showResetModal,
        memoAddTrigger,
        subscriptionAddTrigger,
        goalAddTrigger,
        confirmModal,
    } = ui;






    useEffect(() => {
        localStorage.setItem("hb_active_tab", tab);
    }, [tab]);


    useEffect(() => {
        const onSettingsUpdated = () => {
            void loadSettings().then((settings) => {
                setCardBillingDay(settings.cardBillingDay ?? null);
                setUserPaymentMethods(settings.userPaymentMethods);
                setTransactionTemplates(settings.transactionTemplates ?? []);
                setAutoCategoryRules(settings.autoCategoryRules ?? []);
                setHiddenWidgets(
                    settings.hiddenWidgets ?? DEFAULT_HIDDEN_WIDGETS,
                );
            });
            setSettingsSyncTick((prev) => prev + 1);
        };

        window.addEventListener("hb-settings-updated", onSettingsUpdated);
        return () => {
            window.removeEventListener(
                "hb-settings-updated",
                onSettingsUpdated,
            );
        };
    }, []);




    const yearMonth = toYearMonth(currentDate);
    const applyDataSnapshot = useCallback((snapshot: AppDataSnapshot) => {
        setTransactions(snapshot.transactions);
        setMemos(snapshot.memos);
        setBudgets(snapshot.budgets);
        setRecurring(snapshot.recurring);
        setSubscriptions(snapshot.subscriptions ?? []);
        setGoals(snapshot.goals ?? []);
        setCardBillingDay(snapshot.settings.cardBillingDay ?? null);
        setUserPaymentMethods(snapshot.settings.userPaymentMethods ?? []);
        setCustomExpenseCategories(snapshot.settings.customExpenseCategories);
        setCustomIncomeCategories(snapshot.settings.customIncomeCategories);
        setTransactionTemplates(snapshot.settings.transactionTemplates ?? []);
        setAutoCategoryRules(snapshot.settings.autoCategoryRules ?? []);
        setHiddenWidgets(
            snapshot.settings.hiddenWidgets ?? DEFAULT_HIDDEN_WIDGETS,
        );
    }, []);
    const hydrateData = useCallback(async () => {
        const timeout = new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("data-load-timeout")), DATA_LOAD_TIMEOUT_MS);
        });
        applyDataSnapshot(await Promise.race([loadAllData(), timeout]));
    }, [applyDataSnapshot]);

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
        handlePasswordReset,
        handleLogout,
    } = useAuthSync({hydrateData});

    useEffect(() => {
        if (!authReady || isSyncing) return;
        const action = consumeEntryShortcut(window.location, window.history);
        if (!action) return;
        setTab("home");
        setCurrentDate(new Date());
        setTxInitialType(action);
        dispatchUI({type: "OPEN_TX_MODAL"});
    }, [authReady, isSyncing]);

    const handleResetAllData = useCallback(async () => {
        try {
            await resetAllData();
            await hydrateData();
            showToast("모든 데이터를 초기화했어요.");
        } catch (e) {
            console.error("[handleResetAllData]", e);
            showToast("초기화 중 오류가 발생했어요. 다시 시도해주세요.");
            throw e;
        }
    }, [hydrateData]);

    const activeTab: Tab = tab;
    // 더보기는 마지막으로 연 목표·구독·메모 화면으로 돌아간다
    const [lastMoreTab, setLastMoreTab] = useState<Tab>(MORE_TAB_IDS.includes(tab) ? tab : "goals");
    if (MORE_TAB_IDS.includes(tab) && tab !== lastMoreTab) setLastMoreTab(tab);
    const visibleTabs = useMemo(
        () => [...LEDGER_TABS, {id: lastMoreTab, label: "더보기", Icon: LayoutGrid, matches: MORE_TAB_IDS}],
        [lastMoreTab],
    );

    const prefetchLedgerTab = useCallback((target: Tab) => {
        if (target === "home") {
            void import("./components/Dashboard");
            return;
        }
        if (target === "transactions") {
            void import("./components/TransactionList");
            return;
        }
        if (target === "analytics") {
            void import("./components/Analytics");
            return;
        }
        if (target === "memos") {
            void import("./components/MemoSection");
            return;
        }
        if (target === "subscriptions") {
            void import("./components/SubscriptionView");
            return;
        }
        if (target === "goals") {
            void import("./components/GoalsView");
        }
    }, []);

    const prefetchFabModal = useCallback(() => {
        if (
            activeTab === "memos" ||
            activeTab === "subscriptions" ||
            activeTab === "goals"
        ) {
            return;
        }
        void import("./components/TransactionModal");
    }, [activeTab]);

    const prefetchImportUtilities = useCallback(() => {
        void import("./components/ImportModal");
        void import("./components/PaymentMethodsModal");
    }, []);

    const prefetchHelp = useCallback(() => {
        void import("./components/HelpModal");
    }, []);

    const transitionStartRef = useRef<number | null>(null);
    const transitionLabelRef = useRef<string | null>(null);

    const handleLedgerTabChange = useCallback(
        (nextTab: Tab) => {
            if (import.meta.env.DEV) {
                transitionStartRef.current = performance.now();
                transitionLabelRef.current = `ledger:${nextTab}`;
            }

            prefetchLedgerTab(nextTab);
            setTab(nextTab);
            setFabExpanded(false);
            window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? "auto" : "smooth"});
        },
        [prefetchLedgerTab],
    );

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (transitionStartRef.current === null || !transitionLabelRef.current)
            return;

        const startedAt = transitionStartRef.current;
        const label = transitionLabelRef.current;
        transitionStartRef.current = null;
        transitionLabelRef.current = null;

        const frame1 = requestAnimationFrame(() => {
            const frame2 = requestAnimationFrame(() => {
                const elapsed = performance.now() - startedAt;
                console.debug(
                    `[tab-transition] ${label} ${elapsed.toFixed(1)}ms`,
                );
            });
            void frame2;
        });

        return () => cancelAnimationFrame(frame1);
    }, [activeTab]);

    const sync = useSyncPersistence({hydrateData});
    const {
        isOnline,
        hasPendingSync,
        failedPersistTasks,
        lastRetryReasons,
        isRetryingPersist,
        retryProgress,
        lastRetryResult,
        setLastSyncSuccessAt,
        showSyncConflictModal,
        setShowSyncConflictModal,
        showSyncRecoveryGuideModal,
        setShowSyncRecoveryGuideModal,
        conflictKeys,
        selectedConflictKeys,
        conflictVersionDiffs,
        setConflictVersionDiffs,
        conflictCountDiffs,
        setConflictCountDiffs,
        conflictRemoteUpdatedAt,
        setConflictRemoteUpdatedAt,
        conflictPreferredScopes,
        rememberConflictPolicy,
        setRememberConflictPolicy,
        persist,
        retryFailedPersistTasks,
        getScopesByReasons,
        handleUseRemoteData,
        handleRetryMineAfterSync,
        toggleConflictKey,
        selectRecommendedConflictKeys,
        selectAllConflictKeys,
        clearConflictKeySelection,
        persistInFlightRef,
    } = sync;

    const {
        handleSaveTransaction,
        handleDeleteTransaction,
        handleTransactionArchive,
        handleBulkImport,
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
        handleAddMemo,
        handleUpdateMemo,
        handleDeleteMemo,
        handleTogglePin,
        handleBulkDeleteTransactions,
        handleBulkEditTransactions,
    } = useAppHandlers({
        transactions,
        budgets,
        onRecordSaved: offerInstallAfterSave,
        editingTransaction,
        yearMonth,
        customExpenseCategories,
        customIncomeCategories,
        transactionTemplates,
        autoCategoryRules,
        persist,
        setTransactions,
        setBudgets,
        setRecurring,
        setSubscriptions,
        setGoals,
        setMemos,
        setCustomExpenseCategories,
        setCustomIncomeCategories,
        setUserPaymentMethods,
        setTransactionTemplates,
        setAutoCategoryRules,
        setHiddenWidgets,
        dispatchUI,
    });

    const {
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
    } = useRecurringAutoApply({authReady, isSyncing, recurring, handleApplyRecurring});


    const prevMonth = useCallback(() => {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
        window.scrollTo({top: 0, behavior: "smooth"});
    }, []);
    const nextMonth = useCallback(() => {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
        window.scrollTo({top: 0, behavior: "smooth"});
    }, []);
    const openTransactionsWithBilling = useCallback(
        (billing: "current" | "next") => {
            localStorage.setItem(FILTER_TYPE_KEY, "expense");
            localStorage.setItem(METHOD_FILTER_KEY, "credit");
            localStorage.setItem(BILLING_FILTER_KEY, billing);
            localStorage.removeItem(STATEMENT_MONTH_FILTER_KEY);
            setTab("transactions");
            showToast(
                billing === "current"
                    ? "카드 이번 청구 내역만 표시합니다."
                    : "카드 다음 청구 내역만 표시합니다.",
            );
        },
        [],
    );
    const isCurrentMonth = () => {
        const now = new Date();
        return (
            currentDate.getFullYear() === now.getFullYear() &&
            currentDate.getMonth() === now.getMonth()
        );
    };

    const {monthIncome, monthExpense, monthBalance} = useMemo(() => {
        const cutoff = `${yearMonth}-01`;
        let income = 0,
            expense = 0,
            opening = 0;
        const monthly: Transaction[] = [];
        for (const t of transactions) {
            if (t.date < cutoff) {
                opening += t.type === "income" ? t.amount : -t.amount;
            } else if (t.date.startsWith(yearMonth)) {
                monthly.push(t);
                if (t.type === "income") income += t.amount;
                else expense += t.amount;
            }
        }
        return {
            monthIncome: income,
            monthExpense: expense,
            monthBalance: opening + income - expense,
        };
    }, [transactions, yearMonth]);
    const monthCardDue = useMemo(
        () =>
            calculateCardDueAmount(
                transactions,
                yearMonth,
                cardBillingDay ?? 25,
                userPaymentMethods,
            ),
        [transactions, yearMonth, cardBillingDay, userPaymentMethods],
    );
    const nextMonthCardDue = useMemo(
        () =>
            calculateCardDueAmount(
                transactions,
                shiftYM(yearMonth, 1),
                cardBillingDay ?? 25,
                userPaymentMethods,
            ),
        [transactions, yearMonth, cardBillingDay, userPaymentMethods],
    );
    const syncStatus = useMemo(() => {
        if (!isOnline && hasPendingSync) {
            return {
                title: "오프라인이며 동기화 대기 항목이 있어요",
                label: "오프라인+대기",
            };
        }
        if (!isOnline) {
            return {title: "오프라인 상태입니다", label: "오프라인"};
        }
        return {title: "저장되지 않은 변경사항이 있어요", label: "미동기화"};
    }, [isOnline, hasPendingSync]);

    const showFAB =
        activeTab === "home" ||
        activeTab === "transactions" ||
        activeTab === "memos" ||
        activeTab === "subscriptions" ||
        activeTab === "goals";
    const canShowInstallOffer =
        showInstallBanner && !showModal && !showImport && !showHelp &&
        !showBackup && !showUsageInsights && !showAuthModal && !showCategoryModal &&
        !showPaymentMethodsModal && !showResetModal && !showWidgetSettings &&
        !showAutoCategoryRuleModal && !showTagManagerModal;

    if (!authReady || isSyncing) {
        return (
            <div className="min-h-screen bg-page flex items-center justify-center px-6">
                <div className="w-full max-w-sm rounded-3xl bg-surface border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-black/40 p-6 text-center">
                    <div className="mx-auto w-11 h-11 rounded-2xl bg-tone-blue/10 border border-[rgba(255,255,255,0.08)] flex items-center justify-center">
                        <BrandMark className="brand-mark-loading" />
                    </div>
                    <h2 className="mt-4 text-[17px] font-extrabold text-white tracking-tight">
                        잔고플랜 준비 중
                    </h2>
                    <p className="mt-1 text-sm text-muted font-medium">
                        데이터를 안전하게 불러오고 있어요
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-action text-on-action animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-tone-blue/80 animate-pulse [animation-delay:180ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-tone-blue/65 animate-pulse [animation-delay:360ms]" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ledger-app min-h-dvh bg-page pb-nav-safe">
            <a href="#ledger-main" className="skip-link">본문으로 건너뛰기</a>
            {needRefresh && (
                <div className="fixed bottom-toast-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm">
                    <div className="flex items-center gap-3 bg-surface border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 shadow-xl">
                        <RefreshCw
                            size={16}
                            className="text-accent shrink-0 animate-spin"
                            style={{animationDuration: "2s"}}
                        />
                        <p className="text-sm font-semibold text-white flex-1">
                            새 버전이 있어요!
                        </p>
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="px-3 py-1.5 rounded-xl bg-action text-on-action text-xs font-bold hover:bg-action-hover transition-colors shrink-0"
                        >
                            업데이트
                        </button>
                    </div>
                </div>
            )}

            <header className="ledger-header bg-page sticky top-0 z-40">
                <div className="ledger-header-inner max-w-lg mx-auto px-5 pt-header-safe pb-3">
                    <div className="flex items-center justify-between">
                        <div className="ledger-header-brand flex items-center gap-2">
                            <span className="brand-header-symbol flex items-center justify-center">
                                <BrandMark />
                            </span>
                            <h1 className="brand-wordmark text-[20px] font-extrabold text-white tracking-tight">
                                잔고플랜
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            {/* 오프라인 / 미동기화 상태 배지 */}
                            {(!isOnline || hasPendingSync) && (
                                <div
                                    title={syncStatus.title}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-raised border border-white/6"
                                >
                                    {!isOnline ? (
                                        <WifiOff
                                            size={11}
                                            className="text-expense"
                                        />
                                    ) : (
                                        <CloudOff
                                            size={11}
                                            className="text-warning"
                                        />
                                    )}
                                    <span className="text-[10px] font-bold text-muted">
                                        {syncStatus.label}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <NotificationCenter
                                    transactions={transactions}
                                    budgets={budgets}
                                    recurring={recurring}
                                    subscriptions={subscriptions}
                                    userPaymentMethods={userPaymentMethods}
                                />
                                <HeaderMenu
                                    user={user}
                                    onOpenImport={() => dispatchUI({type: "SET_IMPORT", value: true})}
                                    onOpenPaymentMethods={() => dispatchUI({type: "SET_PAYMENT_METHODS", value: true})}
                                    onOpenAutoCategoryRules={() => setShowAutoCategoryRuleModal(true)}
                                    onOpenBackup={() => setShowBackup(true)}
                                    onReset={() => dispatchUI({type: "SET_RESET", value: true})}
                                    onLogout={() =>
                                        dispatchUI({
                                            type: "OPEN_CONFIRM",
                                            message: "로그아웃 하시겠어요?",
                                            onConfirm: handleLogout,
                                            confirmLabel: "로그아웃",
                                            confirmVariant: "danger",
                                        })
                                    }
                                    onLogin={() => setShowAuthModal(true)}
                                    onPrefetchImport={prefetchImportUtilities}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="ledger-month-picker flex items-center justify-center gap-2 mt-3">
                                <button
                                    aria-label="이전 달 보기"
                                    onClick={prevMonth}
                                    className="w-11 h-11 rounded-full bg-surface border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform"
                                >
                                    <ChevronLeft
                                        size={16}
                                        className="text-muted"
                                    />
                                </button>
                                <button
                                    aria-label={`${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월, 누르면 이번 달로 이동`}
                                    title="누르면 이번 달로 돌아가요"
                                    data-current-month={isCurrentMonth()}
                                    onClick={() => setCurrentDate(new Date())}
                                    className={`px-5 min-h-11 rounded-2xl text-base font-bold transition-all ${isCurrentMonth() ? "bg-white text-fg" : "bg-surface text-muted border border-[rgba(255,255,255,0.06)]"}`}
                                >
                                    {currentDate.getFullYear()}년{" "}
                                    {currentDate.getMonth() + 1}월
                                </button>
                                <button
                                    aria-label="다음 달 보기"
                                    onClick={nextMonth}
                                    className="w-11 h-11 rounded-full bg-surface border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform"
                                >
                                    <ChevronRight
                                        size={16}
                                        className="text-muted"
                                    />
                                </button>
                                {!isCurrentMonth() && (
                                    <button type="button" onClick={() => setCurrentDate(new Date())}
                                        className="min-h-11 px-3 rounded-xl bg-tone-blue/10 text-accent text-xs font-semibold shrink-0">
                                        이번 달
                                    </button>
                                )}
                            </div>

                            {(monthIncome > 0 || monthExpense > 0) && (
                                <div className="mt-3 pb-1 space-y-1.5">
                                    <dl className="ledger-month-totals">
                                      <div><dt>수입</dt>
                                        <dd className="text-xs font-semibold text-income num">
                                            {monthIncome.toLocaleString()}원
                                        </dd></div>
                                      <div><dt>지출</dt>
                                        <dd className="text-xs font-semibold text-expense num">
                                            {monthExpense.toLocaleString()}원
                                        </dd></div>
                                      <div><dt>차액</dt><dd
                                            className={`text-xs font-bold num ${monthBalance >= 0 ? "text-white" : "text-expense"}`}
                                        >
                                            {monthBalance.toLocaleString()}원
                                        </dd></div>
                                    </dl>

                                    {(monthCardDue > 0 ||
                                        nextMonthCardDue > 0) && (
                                        <div className="flex items-center justify-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openTransactionsWithBilling(
                                                        "current",
                                                    )
                                                }
                                                aria-label="카드 이번 청구 내역 필터 보기"
                                                className="text-[10px] font-bold text-warning num hover:text-warning transition-colors px-2 py-0.5 rounded-full bg-tone-amber/12"
                                                title="카드 이번 청구 내역 보기"
                                            >
                                                이번청구{" "}
                                                {monthCardDue.toLocaleString()}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openTransactionsWithBilling(
                                                        "next",
                                                    )
                                                }
                                                aria-label="카드 다음 청구 내역 필터 보기"
                                                className="text-[10px] font-bold text-accent num hover:text-tone-blue-pale transition-colors px-2 py-0.5 rounded-full bg-tone-blue/12"
                                                title="카드 다음 청구 내역 보기"
                                            >
                                                다음청구{" "}
                                                {nextMonthCardDue.toLocaleString()}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                    <SyncStatusBar sync={sync} />
                </div>
                <div className="h-px bg-white/4 mx-5" />
            </header>

            <main id="ledger-main" tabIndex={-1} className="ledger-main max-w-lg mx-auto px-4 py-4">
                <div className="workspace-heading">
                    <div>
                        <h2>{({home: '한눈에 보는 가계부', transactions: '거래 내역', analytics: '소비 분석', subscriptions: '구독 관리', goals: '저축 목표', memos: '나의 메모'})[activeTab]}</h2>
                        <p>{({home: '수입과 지출을 살펴보고 오늘의 기록을 남겨보세요.', transactions: '필요한 내역을 찾고 수입과 지출을 관리하세요.', analytics: '기록 속에서 나의 소비 습관을 발견해보세요.', subscriptions: '정기 결제와 다음 청구일을 함께 확인하세요.', goals: '이루고 싶은 목표를 향해 조금씩 모아보세요.', memos: '기억할 내용과 돈 관리 계획을 남겨보세요.'})[activeTab]}</p>
                    </div>
                </div>
                {MORE_TAB_IDS.includes(activeTab) && (
                    <div className="flex gap-1.5 mb-4" role="group" aria-label="더보기 화면">
                        {MORE_TABS.map(({id, label, Icon}) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={activeTab === id}
                                onClick={() => handleLedgerTabChange(id)}
                                onMouseEnter={() => prefetchLedgerTab(id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 min-h-11 rounded-2xl text-sm font-semibold transition-colors ${activeTab === id ? "bg-tone-blue/20 text-accent" : "bg-surface text-muted hover:text-fg"}`}
                            >
                                <Icon size={15} />
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {canShowInstallOffer && installOfferMode === "automatic" && activeTab === "home" && (
                    <div className="mb-4">
                        <InstallOffer
                            isIosManualInstall={isIosManualInstall}
                            installGuideText={installGuideText}
                            canPrompt={!!deferredPrompt}
                            onLater={closeInstallBanner}
                            onInstall={handleInstallClick}
                        />
                    </div>
                )}
                <Suspense fallback={<WorkspaceSkeleton />}>
                        <LedgerWorkspace
                            onOpenSubscriptions={() => handleLedgerTabChange('subscriptions')}
                            onOpenImport={() => dispatchUI({type: "SET_IMPORT", value: true})}
                            activeTab={activeTab}
                            transactions={transactions}
                            budgets={budgets}
                            recurring={recurring}
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
                            onOpenCategoryModal={() =>
                                dispatchUI({type: "SET_CATEGORY", value: true})
                            }
                            onOpenPaymentMethodsModal={() =>
                                dispatchUI({
                                    type: "SET_PAYMENT_METHODS",
                                    value: true,
                                })
                            }
                            onTransactionAdd={() => {
                                setTxInitialType("expense");
                                dispatchUI({type: "OPEN_TX_MODAL"});
                            }}
                            onTransactionEdit={(t) =>
                                dispatchUI({type: "OPEN_TX_MODAL", editing: t})
                            }
                            onTransactionDelete={handleDeleteTransaction}
                            onBulkDeleteTransactions={
                                handleBulkDeleteTransactions
                            }
                            onBulkEditTransactions={handleBulkEditTransactions}
                            onTransactionArchive={handleTransactionArchive}
                            onMemoAdd={handleAddMemo}
                            onMemoUpdate={handleUpdateMemo}
                            onMemoDelete={handleDeleteMemo}
                            onMemoTogglePin={handleTogglePin}
                            onOpenTagManager={() =>
                                setShowTagManagerModal(true)
                            }
                            onOpenWidgetSettings={() =>
                                setShowWidgetSettings(true)
                            }
                            onOpenHelp={() =>
                                dispatchUI({type: "SET_HELP", value: true})
                            }
                        />
                    </Suspense>
            </main>

            {/* Speed Dial 백드롭 */}
            {fabExpanded && (
                <div
                    className="fixed inset-0 z-29 pointer-events-auto"
                    onClick={() => setFabExpanded(false)}
                />
            )}

            <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
                <div className="ledger-floating-actions max-w-lg mx-auto relative h-0">
                    {showFAB && !(activeTab === "subscriptions" && subscriptions.length === 0) && !(activeTab === "goals" && goals.length === 0) &&
                        (() => {
                            const isSpeedDialTab = !(
                                ["memos", "subscriptions", "goals"] as Tab[]
                            ).includes(activeTab);
                            return (
                                <>
                                    {/* Speed Dial: 수입 버튼 */}
                                    {fabExpanded && isSpeedDialTab && (
                                        <button
                                            className="quick-entry quick-entry-income speed-dial-item pointer-events-auto absolute right-5 bottom-fab-dial-2"
                                            style={{ animationDelay: "0.07s" }}
                                            onClick={() => {
                                                setTxInitialType("income");
                                                setFabExpanded(false);
                                                dispatchUI({
                                                    type: "OPEN_TX_MODAL",
                                                });
                                            }}
                                            aria-label="수입 추가"
                                        >
                                            <ArrowDownLeft size={18} aria-hidden="true" />
                                            <span>수입</span>
                                        </button>
                                    )}
                                    {/* Speed Dial: 지출 버튼 */}
                                    {fabExpanded && isSpeedDialTab && (
                                        <button
                                            className="quick-entry quick-entry-expense speed-dial-item pointer-events-auto absolute right-5 bottom-fab-dial-1"
                                            style={{ animationDelay: "0s" }}
                                            onClick={() => {
                                                setTxInitialType("expense");
                                                setFabExpanded(false);
                                                dispatchUI({
                                                    type: "OPEN_TX_MODAL",
                                                });
                                            }}
                                            aria-label="지출 추가"
                                        >
                                            <ArrowUpRight size={18} aria-hidden="true" />
                                            <span>지출</span>
                                        </button>
                                    )}
                                    {/* 메인 FAB */}
                                    <button
                                        onMouseEnter={prefetchFabModal}
                                        onFocus={prefetchFabModal}
                                        onTouchStart={prefetchFabModal}
                                        onClick={() => {
                                            if (activeTab === "memos") {
                                                dispatchUI({
                                                    type: "TRIGGER_MEMO",
                                                });
                                            } else if (
                                                activeTab === "subscriptions"
                                            ) {
                                                dispatchUI({
                                                    type: "TRIGGER_SUB",
                                                });
                                            } else if (activeTab === "goals") {
                                                dispatchUI({
                                                    type: "TRIGGER_GOAL",
                                                });
                                            } else if (isSpeedDialTab) {
                                                setFabExpanded((v) => !v);
                                            } else {
                                                setTxInitialType("expense");
                                                dispatchUI({
                                                    type: "OPEN_TX_MODAL",
                                                });
                                            }
                                        }}
                                        aria-label={
                                            fabExpanded ? "추가 메뉴 닫기" : activeTab === "memos" ? "메모 추가" : activeTab === "subscriptions" ? "구독 추가" : activeTab === "goals" ? "목표 추가" : "내역 추가"
                                        }
                                        aria-expanded={fabExpanded}
                                        className={`ledger-add-button pointer-events-auto absolute right-5 bottom-fab-safe min-w-12 h-12 px-4 gap-2 rounded-2xl shadow-lg flex items-center justify-center transition-all active:scale-95 ${fabExpanded ? "bg-raised text-white shadow-black/40" : "bg-action text-on-action hover:bg-action-hover shadow-tone-blue/30"}`}
                                    >
                                        <Plus
                                            size={20}
                                            className={`transition-transform duration-200 ${fabExpanded ? "rotate-45" : ""}`}
                                        />
                                        <span className="text-sm font-semibold">{fabExpanded ? "닫기" : activeTab === "memos" ? "메모 추가" : activeTab === "subscriptions" ? "구독 추가" : activeTab === "goals" ? "목표 추가" : "내역 추가"}</span>
                                    </button>
                                </>
                            );
                        })()}

                    <button
                        onClick={() =>
                            dispatchUI({type: "SET_HELP", value: true})
                        }
                        onMouseEnter={prefetchHelp}
                        onFocus={prefetchHelp}
                        onTouchStart={prefetchHelp}
                        aria-label="사용 가이드"
                        className="pointer-events-auto absolute left-5 bottom-fab-safe w-10 h-10 bg-surface border border-white/10 hover:bg-tone-chip active:scale-95 text-muted hover:text-white rounded-full flex items-center justify-center transition-all text-sm font-bold"
                    >
                        ?
                    </button>
                </div>
            </div>

            {canShowInstallOffer && installOfferMode === "manual" && (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-banner-safe z-50 w-[calc(100%-2.5rem)] max-w-sm">
                    <InstallOffer
                        isIosManualInstall={isIosManualInstall}
                        installGuideText={installGuideText}
                        canPrompt={!!deferredPrompt}
                        onLater={closeInstallBanner}
                        onInstall={handleInstallClick}
                    />
                </div>
            )}

            <BottomNavigation
                ledgerTabs={visibleTabs}
                activeTab={activeTab}
                onLedgerTabChange={handleLedgerTabChange}
                onLedgerTabHover={prefetchLedgerTab}
            />

            <ToastHost />

            {showHelp && (
                <Suspense fallback={null}>
                    <HelpModal
                        onBackup={() => { dispatchUI({type: "SET_HELP", value: false}); setShowBackup(true); }}
                        onUsageInsights={() => { dispatchUI({type: "SET_HELP", value: false}); setShowUsageInsights(true); }}
                        onInstall={canInstall ? () => { dispatchUI({type: "SET_HELP", value: false}); openInstallGuide(); } : undefined}
                        onClose={() =>
                            dispatchUI({type: "SET_HELP", value: false})
                        }
                    />
                </Suspense>
            )}
            {showBackup && <Suspense fallback={null}><BackupModal
                accountLabel={user?.email ?? user?.displayName ?? undefined}
                onClose={() => setShowBackup(false)}
                canRestore={() => !isSyncing && !isRetryingPersist && !hasPendingSync && failedPersistTasks.length === 0 && persistInFlightRef.current === 0}
                onRestored={(snapshot, cacheSaved) => {
                    // Keep the confirmed snapshot intact even on a device set to auto-apply recurring entries.
                    suppressAutoApply();
                    applyDataSnapshot(snapshot);
                    setSettingsSyncTick(tick => tick + 1);
                    setShowBackup(false);
                    setLastSyncSuccessAt(Date.now());
                    showToast(cacheSaved ? '전체 데이터와 설정을 복원했어요.' : '계정에는 복원했지만 기기 캐시를 저장하지 못했어요. 저장 공간을 확인해주세요.', 5000);
                }}
            /></Suspense>}
            {showUsageInsights && <Suspense fallback={null}><UsageInsightsModal onClose={() => setShowUsageInsights(false)} /></Suspense>}
            {showImport && (
                <Suspense fallback={null}>
                    <ImportModal
                        onSaveRules={handleSaveAutoCategoryRules}
                        existingTransactions={transactions}
                        autoCategoryRules={autoCategoryRules}
                        onImport={handleBulkImport}
                        onClose={() =>
                            dispatchUI({type: "SET_IMPORT", value: false})
                        }
                    />
                </Suspense>
            )}
            {showModal && (
                <Suspense fallback={null}>
                    <TransactionModal
                        onSaveRules={handleSaveAutoCategoryRules}
                        transaction={editingTransaction}
                        onSave={handleSaveTransaction}
                        onClose={() => {
                            dispatchUI({type: "CLOSE_TX_MODAL"});
                            setFabExpanded(false);
                        }}
                        customExpenseCategories={customExpenseCategories}
                        customIncomeCategories={customIncomeCategories}
                        userPaymentMethods={userPaymentMethods}
                        recentTransactions={transactions}
                        transactionTemplates={transactionTemplates}
                        onSaveTemplates={handleSaveTemplates}
                        onOpenCategoryModal={() =>
                            dispatchUI({type: "SET_CATEGORY", value: true})
                        }
                        onOpenPaymentMethodsModal={() =>
                            dispatchUI({
                                type: "SET_PAYMENT_METHODS",
                                value: true,
                            })
                        }
                        autoCategoryRules={autoCategoryRules}
                        initialType={
                            editingTransaction ? undefined : txInitialType
                        }
                    />
                </Suspense>
            )}
            {showCategoryModal && (
                <Suspense fallback={null}>
                    <CategoryModal
                        customExpenseCategories={customExpenseCategories}
                        customIncomeCategories={customIncomeCategories}
                        usage={{ transactions, recurring, budgets, subscriptions, goals, templates: transactionTemplates, rules: autoCategoryRules }}
                        onSave={handleSaveCategories}
                        onClose={() =>
                            dispatchUI({type: "SET_CATEGORY", value: false})
                        }
                    />
                </Suspense>
            )}
            {showPaymentMethodsModal && (
                <Suspense fallback={null}>
                    <PaymentMethodsModal
                        userPaymentMethods={userPaymentMethods}
                        onSave={handleSavePaymentMethods}
                        onClose={() =>
                            dispatchUI({
                                type: "SET_PAYMENT_METHODS",
                                value: false,
                            })
                        }
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
            {showResetModal && (
                <Suspense fallback={null}>
                    <ResetAllDataModal
                        isLoggedIn={!!user}
                        onConfirm={handleResetAllData}
                        onClose={() =>
                            dispatchUI({type: "SET_RESET", value: false})
                        }
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
                    <MergeLocalDataModal
                        onConfirm={handleMergeConfirm}
                        onCancel={handleMergeCancel}
                        counts={localDataCounts}
                    />
                </Suspense>
            )}

            {showSyncConflictModal && (
                <Suspense fallback={null}>
                    <SyncConflictModal
                        conflictKeys={conflictKeys}
                        selectedKeys={selectedConflictKeys}
                        recommendedKeys={getDefaultSelectedConflictKeys(
                            conflictKeys,
                            conflictPreferredScopes,
                        )}
                        versionDiffs={conflictVersionDiffs}
                        countDiffs={conflictCountDiffs}
                        remoteUpdatedAt={conflictRemoteUpdatedAt}
                        rememberPolicy={rememberConflictPolicy}
                        onToggleKey={(key) =>
                            toggleConflictKey(key as RemoteVersionKey)
                        }
                        onSelectRecommended={selectRecommendedConflictKeys}
                        onSelectAll={selectAllConflictKeys}
                        onClearSelection={clearConflictKeySelection}
                        onToggleRememberPolicy={setRememberConflictPolicy}
                        onUseRemote={handleUseRemoteData}
                        onRetryMine={handleRetryMineAfterSync}
                        onClose={() => {
                            setShowSyncConflictModal(false);
                            setConflictVersionDiffs({});
                            setConflictCountDiffs({});
                            setConflictRemoteUpdatedAt(null);
                        }}
                    />
                </Suspense>
            )}

            {showSyncRecoveryGuideModal && (
                <Suspense fallback={null}>
                    <SyncRecoveryGuideModal
                        reasons={Array.from(
                            new Set(
                                Object.values(lastRetryReasons).flatMap(
                                    (codes) => codes ?? [],
                                ),
                            ),
                        )}
                        onOpenConflict={() => {
                            setShowSyncRecoveryGuideModal(false);
                            if (conflictKeys.length > 0) {
                                setShowSyncConflictModal(true);
                            } else {
                                showToast("현재 충돌 항목이 없어요.");
                            }
                        }}
                        onRetryNow={() => {
                            retryFailedPersistTasks(undefined, "all");
                        }}
                        onRetryConflictOnly={() => {
                            const scopes = getScopesByReasons(["conflict"]);
                            if (scopes.length === 0) {
                                showToast("충돌 항목이 없어요.");
                                return;
                            }
                            retryFailedPersistTasks(scopes, "conflict-only");
                        }}
                        onRetrySaveFailedOnly={() => {
                            const scopes = getScopesByReasons(["save-failed"]);
                            if (scopes.length === 0) {
                                showToast("저장오류 항목이 없어요.");
                                return;
                            }
                            retryFailedPersistTasks(scopes, "save-failed-only");
                        }}
                        isRetrying={isRetryingPersist}
                        retryProgress={retryProgress}
                        retryResult={
                            lastRetryResult
                                ? {
                                      attempted: lastRetryResult.attempted,
                                      succeeded: lastRetryResult.succeeded,
                                      failed: lastRetryResult.failed,
                                      mode: lastRetryResult.mode,
                                      finishedAt: lastRetryResult.finishedAt,
                                      failedScopeSummary:
                                          lastRetryResult.failedByScope
                                              .map(
                                                  (entry) =>
                                                      `${scopeLabel(entry.scope)} ${entry.count}건`,
                                              )
                                              .join(", "),
                                  }
                                : null
                        }
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
                        onConfirm={confirmAutoApply}
                        onDismiss={dismissAutoApply}
                    />
                </Suspense>
            )}

            {showAutoApplyResultModal && autoApplyResultItems.length > 0 && (
                <Suspense fallback={null}>
                    <AutoApplyResultModal
                        applied={autoApplyResultItems}
                        onClose={closeAutoApplyResult}
                    />
                </Suspense>
            )}

            {showAuthModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="auth-modal-title"
                >
                    <div className="auth-modal-panel w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3
                                id="auth-modal-title"
                                className="text-base font-bold"
                            >
                                계정 로그인
                            </h3>
                            <button
                                aria-label="로그인 모달 닫기"
                                onClick={() => setShowAuthModal(false)}
                                className="auth-secondary text-xs font-bold"
                            >
                                닫기
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setAuthMode("login")}
                                aria-pressed={authMode === "login"}
                                className="auth-mode-button flex-1 py-2 rounded-xl text-xs font-bold transition-colors"
                            >
                                이메일 로그인
                            </button>
                            <button
                                onClick={() => setAuthMode("signup")}
                                aria-pressed={authMode === "signup"}
                                className="auth-mode-button flex-1 py-2 rounded-xl text-xs font-bold transition-colors"
                            >
                                회원가입
                            </button>
                        </div>

                        <div className="space-y-2">
                            <input
                                aria-label="이메일"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                type="email"
                                placeholder="이메일"
                                className="auth-input w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-tone-blue"
                            />
                            <input
                                aria-label="비밀번호"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type="password"
                                placeholder="비밀번호 (6자 이상)"
                                className="auth-input w-full px-3 py-2 rounded-xl text-sm outline-none focus:border-tone-blue"
                            />
                            {authMode === "login" && (
                                <button type="button" onClick={handlePasswordReset} disabled={authBusy} className="auth-secondary block ml-auto text-xs font-semibold disabled:opacity-50">
                                    비밀번호를 잊으셨나요?
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleEmailAuth}
                            disabled={authBusy}
                            className="w-full py-2.5 rounded-xl bg-action text-on-action disabled:opacity-50 text-sm font-bold"
                        >
                            {authBusy
                                ? "처리 중..."
                                : authMode === "signup"
                                  ? "이메일 회원가입"
                                  : "이메일 로그인"}
                        </button>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={authBusy}
                            className="w-full py-2.5 rounded-xl bg-[var(--action)] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
                        >
                            {authBusy ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <GoogleIcon />
                            )}
                            {authBusy ? "처리 중..." : "구글 로그인"}
                        </button>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-70"
                    onClick={() => dispatchUI({type: "CLOSE_CONFIRM"})}
                >
                    <div
                        className="bg-surface rounded-3xl p-6 mx-4 max-w-xs w-full border border-white/8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-white font-semibold text-center text-[15px] mb-6">
                            {confirmModal.message}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() =>
                                    dispatchUI({type: "CLOSE_CONFIRM"})
                                }
                                className="flex-1 py-3 rounded-2xl bg-raised text-muted font-bold text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    dispatchUI({type: "CLOSE_CONFIRM"});
                                }}
                                className={`flex-1 py-3 rounded-2xl font-bold text-sm ${confirmModal.confirmVariant === "primary" ? "bg-tone-blue/20 text-accent" : "bg-tone-red/20 text-expense"}`}
                            >
                                {confirmModal.confirmLabel ?? "삭제"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
