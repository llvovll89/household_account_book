import CategoryIcon from './ui/CategoryIcon'
import PaymentMethodIcon from './ui/PaymentMethodIcon'
import {useEffect, useMemo, useState, useRef} from "react";
import {
    Pencil,
    Trash2,
    Search,
    X,
    CalendarDays,
    List as ListIcon,
    FileDown,
    Hash,
    ChevronDown,
    ChevronUp,
    CheckSquare,
    Square,
} from "lucide-react";
import type {Transaction, UserPaymentMethod} from "../types";
import {
    CATEGORY_EMOJI,
    CATEGORY_COLOR,
    PAYMENT_METHOD_LABEL,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
} from "../types";
import CalendarView from "./CalendarView";
import ExportModal from "./ExportModal";
import FancyDatePicker from "./FancyDatePicker";
import TransactionDetailModal from "./TransactionDetailModal";
import {fmt, parseYmdLocal, toLocalDateStr} from "../lib/format";
import EmptyState from "./ui/EmptyState";
import {loadSettings, saveSettings} from "../lib/storage";
import type {SwipeSensitivity} from "../lib/storage";
import {
    getBillingStage,
    getStatementYMForCardExpense,
    isCreditPaymentMethod,
    resolveCardBillingDay,
    resolvePaymentMethod,
} from "../lib/cardBilling";
import {showToast} from "../lib/toast";
import { InlineDialog } from './ui/InlineDialog'

interface Props {
    transactions: Transaction[];
    yearMonth: string;
    userPaymentMethods?: UserPaymentMethod[];
    onAddTransaction?: () => void;
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    onBulkDelete?: (ids: string[]) => void;
    onBulkEdit?: (ids: string[], category: string) => void;
    onArchiveDone?: (transactionIds: string[]) => void;
    onOpenTagManager?: () => void;
}

type ViewMode = "list" | "calendar";

type FilterType = "all" | "income" | "expense";
type MethodFilterType = "all" | "cash" | "check" | "credit" | "transfer" | string;
type BillingFilterType = "all" | "current" | "next" | "later";
type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type PeriodMode = "day" | "week" | "month";
type QuickFilterPreset =
    | "all"
    | "cash-expense"
    | "check-expense"
    | "credit-current"
    | "credit-next";
type CreditStatementMeta = {
    statementYM: string;
    stage: "current" | "next" | "later" | "past";
    txBillingDay: number;
};
type ResolvedPaymentMethod = ReturnType<typeof resolvePaymentMethod>;

const FILTER_TYPE_KEY = "hb_tx_type_filter";
const METHOD_FILTER_KEY = "hb_tx_method_filter";
const BILLING_FILTER_KEY = "hb_tx_billing_filter";
const STATEMENT_MONTH_FILTER_KEY = "hb_tx_statement_month_filter";
const FILTER_PANEL_OPEN_KEY = "hb_tx_filter_panel_open";
const BALANCE_SECTION_OPEN_KEY = "hb_tx_balance_section_open";
const ACTIVE_FILTERS_SECTION_OPEN_KEY = "hb_tx_active_filters_section_open";
const INSIGHTS_SECTION_OPEN_KEY = "hb_tx_insights_section_open";
const SWIPE_SENSITIVITY_KEY = "hb_tx_swipe_sensitivity";
const SEARCH_SESSION_KEY = "hb_tx_search";
const SORT_OPTION_KEY = "hb_tx_sort_option";
const GROUP_PAGE_SIZE = 12;
const ITEM_PAGE_SIZE = 20;

function getInitialSectionOpen(storageKey: string, defaultOpen = false) {
    const saved = localStorage.getItem(storageKey);
    if (saved === "true") return true;
    if (saved === "false") return false;
    return defaultOpen;
}

function HighlightText({
    text,
    query,
    className,
}: {
    text: string;
    query: string;
    className?: string;
}) {
    const re = useMemo(() => {
        if (!query.trim()) return null;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(${escaped})`, "gi");
    }, [query]);
    if (!re) return <span className={className}>{text}</span>;
    const parts = text.split(re);
    return (
        <span className={className}>
            {parts.map((p, i) =>
                p.toLowerCase() === query.toLowerCase() ? (
                    <mark
                        key={i}
                        className="bg-tone-amber/30 text-warning rounded-sm not-italic"
                    >
                        {p}
                    </mark>
                ) : (
                    p
                ),
            )}
        </span>
    );
}

export default function TransactionList({
    transactions,
    yearMonth,
    userPaymentMethods = [],
    onAddTransaction,
    onEdit,
    onDelete,
    onBulkDelete,
    onBulkEdit,
    onArchiveDone,
    onOpenTagManager,
}: Props) {
    const [filter, setFilter] = useState<FilterType>(() => {
        const saved = localStorage.getItem(FILTER_TYPE_KEY);
        if (saved === "income" || saved === "expense" || saved === "all")
            return saved;
        return "all";
    });
    const [methodFilter, setMethodFilter] = useState<MethodFilterType>(() => {
        const saved = localStorage.getItem(METHOD_FILTER_KEY);
        if (saved === "card") return "credit";
        if (
            saved === "cash" ||
            saved === "check" ||
            saved === "credit" ||
            saved === "transfer" ||
            saved === "all"
        )
            return saved;
        return "all";
    });
    const [billingFilter, setBillingFilter] = useState<BillingFilterType>(
        () => {
            const saved = localStorage.getItem(BILLING_FILTER_KEY);
            if (
                saved === "current" ||
                saved === "next" ||
                saved === "later" ||
                saved === "all"
            )
                return saved;
            return "all";
        },
    );
    const [sortOption, setSortOption] = useState<SortOption>(() => {
        const saved = localStorage.getItem(SORT_OPTION_KEY);
        if (
            saved === "date-desc" ||
            saved === "date-asc" ||
            saved === "amount-desc" ||
            saved === "amount-asc"
        )
            return saved;
        return "date-desc";
    });
    const [minAmountStr, setMinAmountStr] = useState("");
    const [maxAmountStr, setMaxAmountStr] = useState("");
    const [search, setSearch] = useState(() => {
        if (typeof window === "undefined") return "";
        return sessionStorage.getItem(SEARCH_SESSION_KEY) ?? "";
    });
    const [searchAllPeriods, setSearchAllPeriods] = useState(false);
    const [delayedSearch, setDebouncedSearch] = useState(search);
    const debouncedSearch = search.trim() ? delayedSearch : "";

    useEffect(() => {
        const trimmed = search.trim();

        const delay =
            trimmed.length <= 2 ? 120 : trimmed.length <= 5 ? 220 : 320;
        const timer = setTimeout(() => setDebouncedSearch(search), delay);
        return () => clearTimeout(timer);
    }, [search]);
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [showExport, setShowExport] = useState(false);
    const toolsRef = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const dismissTools = (event: PointerEvent) => {
            const tools = toolsRef.current;
            if (tools?.open && event.target instanceof Node && !tools.contains(event.target)) tools.open = false;
        };
        document.addEventListener('pointerdown', dismissTools);
        return () => document.removeEventListener('pointerdown', dismissTools);
    }, []);
    const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
    const [baseDate, setBaseDate] = useState(`${yearMonth}-01`);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [showTagSummary, setShowTagSummary] = useState(false);
    const [receiptModal, setReceiptModal] = useState({open: false, url: ""});
    const [detailTransaction, setDetailTransaction] =
        useState<Transaction | null>(null);
    const [swipedId, setSwipedId] = useState<string | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkCategoryPicker, setShowBulkCategoryPicker] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
        new Set(),
    );
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const didHydrateSwipeRef = useRef(false);
    const pendingDeleteTimers = useRef<
        Map<string, ReturnType<typeof setTimeout>>
    >(new Map());
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(
        new Set(),
    );
    const [swipeHintSeen, setSwipeHintSeen] = useState(
        () => localStorage.getItem("hb_swipe_hint_seen") === "1",
    );
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [cardBillingDay, setCardBillingDay] = useState(25);
    const [editingBillingDay, setEditingBillingDay] = useState(false);
    const [billingDayInput, setBillingDayInput] = useState("25");
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(() =>
        getInitialSectionOpen(FILTER_PANEL_OPEN_KEY, false),
    );
    const [isBalanceSectionOpen, setIsBalanceSectionOpen] = useState(() =>
        getInitialSectionOpen(BALANCE_SECTION_OPEN_KEY),
    );
    const [isActiveFiltersSectionOpen, setIsActiveFiltersSectionOpen] =
        useState(() => getInitialSectionOpen(ACTIVE_FILTERS_SECTION_OPEN_KEY));
    const [isInsightsSectionOpen, setIsInsightsSectionOpen] = useState(() =>
        getInitialSectionOpen(INSIGHTS_SECTION_OPEN_KEY),
    );
    const [swipeSensitivity, setSwipeSensitivity] =
        useState<SwipeSensitivity>("medium");
    const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);
    const [visibleItemCountByDate, setVisibleItemCountByDate] = useState<
        Record<string, number>
    >({});
    const [statementMonthFilter, setStatementMonthFilter] = useState<
        string | null
    >(() => {
        const saved = localStorage.getItem(STATEMENT_MONTH_FILTER_KEY);
        if (!saved) return null;
        return /^\d{4}-\d{2}$/.test(saved) ? saved : null;
    });

    useEffect(() => {
        localStorage.setItem(FILTER_TYPE_KEY, filter);
    }, [filter]);

    useEffect(() => {
        localStorage.setItem(METHOD_FILTER_KEY, methodFilter);
    }, [methodFilter]);

    useEffect(() => {
        localStorage.setItem(BILLING_FILTER_KEY, billingFilter);
    }, [billingFilter]);

    useEffect(() => {
        localStorage.setItem(SORT_OPTION_KEY, sortOption);
    }, [sortOption]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!search.trim()) {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            return;
        }
        sessionStorage.setItem(SEARCH_SESSION_KEY, search);
    }, [search]);

    useEffect(() => {
        localStorage.setItem(FILTER_PANEL_OPEN_KEY, String(isFilterPanelOpen));
    }, [isFilterPanelOpen]);

    useEffect(() => {
        localStorage.setItem(
            BALANCE_SECTION_OPEN_KEY,
            String(isBalanceSectionOpen),
        );
    }, [isBalanceSectionOpen]);

    useEffect(() => {
        localStorage.setItem(
            ACTIVE_FILTERS_SECTION_OPEN_KEY,
            String(isActiveFiltersSectionOpen),
        );
    }, [isActiveFiltersSectionOpen]);

    useEffect(() => {
        localStorage.setItem(
            INSIGHTS_SECTION_OPEN_KEY,
            String(isInsightsSectionOpen),
        );
    }, [isInsightsSectionOpen]);

    useEffect(() => {
        if (!didHydrateSwipeRef.current) return;
        localStorage.setItem(SWIPE_SENSITIVITY_KEY, swipeSensitivity);

        void (async () => {
            try {
                const current = await loadSettings();
                if (current.swipeSensitivity === swipeSensitivity) return;
                await saveSettings({...current, swipeSensitivity});
            } catch {
                showToast(
                    "스와이프 감도 저장에 실패했어요. 설정을 다시 확인해주세요.",
                );
            }
        })();
    }, [swipeSensitivity]);

    useEffect(() => {
        if (!statementMonthFilter) {
            localStorage.removeItem(STATEMENT_MONTH_FILTER_KEY);
            return;
        }
        localStorage.setItem(STATEMENT_MONTH_FILTER_KEY, statementMonthFilter);
    }, [statementMonthFilter]);

    useEffect(() => {
        let cancelled = false;

        void loadSettings().then((settings) => {
            if (!cancelled) {
                const firstCredit = settings.userPaymentMethods.find(
                    (m) => m.type === "credit",
                );
                setCardBillingDay(
                    firstCredit?.billingDay ?? settings.cardBillingDay ?? 25,
                );

                const legacy = localStorage.getItem(SWIPE_SENSITIVITY_KEY);
                const legacySensitivity: SwipeSensitivity | null =
                    legacy === "low" || legacy === "medium" || legacy === "high"
                        ? legacy
                        : null;
                const nextSensitivity =
                    settings.swipeSensitivity ?? legacySensitivity ?? "medium";

                setSwipeSensitivity(nextSensitivity);
                didHydrateSwipeRef.current = true;

                if (settings.swipeSensitivity !== nextSensitivity) {
                    void saveSettings({
                        ...settings,
                        swipeSensitivity: nextSensitivity,
                    }).catch(() => {
                        // 초기 마이그레이션 저장 실패는 다음 사용자 변경 시 재시도된다.
                    });
                }
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    async function handleSaveBillingDay() {
        const val = parseInt(billingDayInput, 10);
        if (Number.isNaN(val) || val < 1 || val > 31) {
            showToast("결제일은 1~31 사이 숫자여야 해요.");
            return;
        }
        try {
            const current = await loadSettings();
            const nextMethods = current.userPaymentMethods.map((method) =>
                method.type === "credit"
                    ? {...method, billingDay: val}
                    : method,
            );
            await saveSettings({
                ...current,
                cardBillingDay: val,
                userPaymentMethods: nextMethods,
            });
            setCardBillingDay(val);
            setEditingBillingDay(false);
            showToast(`카드 결제일이 ${val}일로 저장됐어요.`);
        } catch {
            showToast("카드 결제일 저장에 실패했어요.");
        }
    }

    function handleDeleteWithUndo(id: string) {
        setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setSwipedId(null);
        const timer = setTimeout(() => {
            onDelete(id);
            setPendingDeleteIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            pendingDeleteTimers.current.delete(id);
        }, 3500);
        pendingDeleteTimers.current.set(id, timer);
        showToast("내역이 삭제됐어요", 3500, "info", {
            label: "실행 취소",
            onClick: () => {
                clearTimeout(pendingDeleteTimers.current.get(id));
                pendingDeleteTimers.current.delete(id);
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            },
        });
    }

    const monthTx = useMemo(
        () => transactions.filter((t) => t.date.startsWith(yearMonth)),
        [transactions, yearMonth],
    );

    const latestMonthDate = useMemo(() => {
        if (monthTx.length === 0) return `${yearMonth}-01`;
        return monthTx.reduce(
            (latest, t) => (t.date > latest ? t.date : latest),
            monthTx[0].date,
        );
    }, [monthTx, yearMonth]);

    const normalizedBaseDate = useMemo(() => {
        const [y, m] = yearMonth.split("-").map(Number);
        const defaultDate = `${yearMonth}-01`;
        if (!baseDate || !baseDate.startsWith(yearMonth))
            return latestMonthDate || defaultDate;

        const day = Number(baseDate.slice(8, 10));
        const daysInMonth = new Date(y, m, 0).getDate();
        const safeDay = Number.isFinite(day)
            ? Math.min(Math.max(day, 1), daysInMonth)
            : 1;
        return `${yearMonth}-${String(safeDay).padStart(2, "0")}`;
    }, [baseDate, yearMonth, latestMonthDate]);

    const weekRange = useMemo(() => {
        const d = parseYmdLocal(normalizedBaseDate);
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const toYmd = (date: Date) => toLocalDateStr(date);
        return {start: toYmd(start), end: toYmd(end)};
    }, [normalizedBaseDate]);

    const monthLastDate = useMemo(() => {
        const [y, m] = yearMonth.split("-").map(Number);
        return `${yearMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    }, [yearMonth]);

    const monthly = useMemo(() => {
        const normalizedSearch = debouncedSearch
            .replace(/^#/, "")
            .toLowerCase();
        const hasSearch = !!debouncedSearch;
        const selectedMethod =
            methodFilter !== "all"
                ? userPaymentMethods.find((m) => m.id === methodFilter)
                : undefined;
        const methodFilterIsCardId = !!selectedMethod;
        const minAmount = minAmountStr ? Number(minAmountStr) : null;
        const maxAmount = maxAmountStr ? Number(maxAmountStr) : null;
        const result: Transaction[] = [];

        // 청구 필터는 거래일이 아니라 청구월 기준이라, 전월 결제분이 이번 청구에 들어갈 수 있다
        // 전체 기간 검색은 보고 있는 달·일·주와 관계없이 모든 내역에서 찾는다
        const searchEverywhere = hasSearch && searchAllPeriods;
        const source =
            statementMonthFilter || billingFilter !== "all" || searchEverywhere
                ? transactions
                : monthTx;
        for (const t of source) {
            if (pendingDeleteIds.has(t.id)) continue;

            if (!searchEverywhere) {
                if (periodMode === "day" && t.date !== normalizedBaseDate) continue;
                if (
                    periodMode === "week" &&
                    (t.date < weekRange.start || t.date > weekRange.end)
                )
                    continue;
            }

            if (filter !== "all" && t.type !== filter) continue;

            if (methodFilter !== "all") {
                if (methodFilterIsCardId) {
                    if (!selectedMethod) continue;
                    if (t.paymentMethodId) {
                        if (t.paymentMethodId !== methodFilter) continue;
                    } else if (selectedMethod.type === "credit") {
                        if (!isCreditPaymentMethod(t.paymentMethod)) continue;
                    } else if (
                        (t.paymentMethod ?? "cash") !== selectedMethod.type
                    ) {
                        continue;
                    }
                } else {
                    const method = t.paymentMethod ?? "cash";
                    if (methodFilter === "credit") {
                        if (!isCreditPaymentMethod(method)) continue;
                    } else if (method !== methodFilter) {
                        continue;
                    }
                }
            }

            if (statementMonthFilter || billingFilter !== "all") {
                if (
                    t.type !== "expense" ||
                    !isCreditPaymentMethod(t.paymentMethod)
                )
                    continue;
                const statementYM = getStatementYMForCardExpense(
                    t.date,
                    resolveCardBillingDay(
                        t,
                        userPaymentMethods,
                        cardBillingDay,
                    ),
                );
                if (
                    statementMonthFilter &&
                    statementYM !== statementMonthFilter
                )
                    continue;
                if (billingFilter !== "all") {
                    const stage = getBillingStage(yearMonth, statementYM);
                    if (stage !== billingFilter) continue;
                }
            }

            if (hasSearch) {
                const matchesSearch =
                    t.category.toLowerCase().includes(normalizedSearch) ||
                    t.description.toLowerCase().includes(normalizedSearch) ||
                    (t.tags ?? []).some((tag) =>
                        tag.toLowerCase().includes(normalizedSearch),
                    );
                if (!matchesSearch) continue;
            }

            if (activeTag && !(t.tags ?? []).includes(activeTag)) continue;

            if (minAmount !== null && t.amount < minAmount) continue;
            if (maxAmount !== null && t.amount > maxAmount) continue;

            result.push(t);
        }

        switch (sortOption) {
            case "date-asc":
                result.sort(
                    (a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.createdAt - b.createdAt,
                );
                break;
            case "amount-desc":
                result.sort((a, b) => b.amount - a.amount);
                break;
            case "amount-asc":
                result.sort((a, b) => a.amount - b.amount);
                break;
            default:
                result.sort(
                    (a, b) =>
                        b.date.localeCompare(a.date) ||
                        b.createdAt - a.createdAt,
                );
        }


        return result;
    }, [
        transactions,
        searchAllPeriods,
        monthTx,
        periodMode,
        normalizedBaseDate,
        weekRange,
        filter,
        methodFilter,
        billingFilter,
        statementMonthFilter,
        debouncedSearch,
        activeTag,
        cardBillingDay,
        yearMonth,
        userPaymentMethods,
        sortOption,
        minAmountStr,
        maxAmountStr,
        pendingDeleteIds,
    ]);

    const monthlyDerived = useMemo(() => {
        const groupedMap = new Map<
            string,
            {
                date: string;
                list: Transaction[];
                income: number;
                expense: number;
                balance: number;
            }
        >();
        const tagMap = new Map<
            string,
            {income: number; expense: number; count: number}
        >();
        const monthlyExpenseCategoryMap: Record<string, number> = {};
        const methodSummary: Record<
            "cash" | "check" | "credit" | "transfer",
            {income: number; expense: number}
        > = {
            cash: {income: 0, expense: 0},
            transfer: {income: 0, expense: 0},
            check: {income: 0, expense: 0},
            credit: {income: 0, expense: 0},
        };
        const creditStatementMetaById = new Map<string, CreditStatementMeta>();
        const resolvedMethodById = new Map<string, ResolvedPaymentMethod>();

        let filteredIncome = 0;
        let filteredExpense = 0;
        let maxExpenseAmount = 0;
        let totalAmount = 0;
        let maxExpenseTx: Transaction | null = null;

        monthly.forEach((t) => {
            totalAmount += t.amount;

            const grouped = groupedMap.get(t.date);
            if (grouped) {
                grouped.list.push(t);
                if (t.type === "income") grouped.income += t.amount;
                else grouped.expense += t.amount;
                grouped.balance = grouped.income - grouped.expense;
            } else {
                const income = t.type === "income" ? t.amount : 0;
                const expense = t.type === "expense" ? t.amount : 0;
                groupedMap.set(t.date, {
                    date: t.date,
                    list: [t],
                    income,
                    expense,
                    balance: income - expense,
                });
            }

            if (t.type === "income") {
                filteredIncome += t.amount;
            } else {
                filteredExpense += t.amount;
                monthlyExpenseCategoryMap[t.category] =
                    (monthlyExpenseCategoryMap[t.category] || 0) + t.amount;
                if (t.amount > maxExpenseAmount) maxExpenseAmount = t.amount;
                if (!maxExpenseTx || t.amount > maxExpenseTx.amount)
                    maxExpenseTx = t;
            }

            const resolvedMethod = resolvePaymentMethod(t, userPaymentMethods);
            resolvedMethodById.set(t.id, resolvedMethod);
            if (t.type === "income")
                methodSummary[resolvedMethod.type].income += t.amount;
            else methodSummary[resolvedMethod.type].expense += t.amount;

            const tags = t.tags ?? [];
            tags.forEach((tag) => {
                const cur = tagMap.get(tag) ?? {
                    income: 0,
                    expense: 0,
                    count: 0,
                };
                if (t.type === "income") cur.income += t.amount;
                else cur.expense += t.amount;
                cur.count += 1;
                tagMap.set(tag, cur);
            });

            if (
                t.type === "expense" &&
                isCreditPaymentMethod(t.paymentMethod)
            ) {
                const txBillingDay = resolveCardBillingDay(
                    t,
                    userPaymentMethods,
                    cardBillingDay,
                );
                const statementYM = getStatementYMForCardExpense(
                    t.date,
                    txBillingDay,
                );
                const stage = getBillingStage(yearMonth, statementYM);
                creditStatementMetaById.set(t.id, {
                    statementYM,
                    stage,
                    txBillingDay,
                });
            }
        });

        let topExpenseCategory: [string, number] | null = null;
        Object.entries(monthlyExpenseCategoryMap).forEach(
            ([category, amount]) => {
                if (!topExpenseCategory || amount > topExpenseCategory[1]) {
                    topExpenseCategory = [category, amount];
                }
            },
        );

        const derived = {
            grouped: Array.from(groupedMap.values()),
            tagSummary: Array.from(tagMap.entries()).sort(
                (a, b) =>
                    b[1].income + b[1].expense - (a[1].income + a[1].expense),
            ),
            filteredIncome,
            filteredExpense,
            maxExpenseAmount,
            methodSummary,
            creditStatementMetaById,
            resolvedMethodById,
            topExpenseCategory,
            maxExpenseTx,
            avgAmt:
                monthly.length > 0
                    ? Math.round(totalAmount / monthly.length)
                    : 0,
        };


        return derived;
    }, [
        monthly,
        userPaymentMethods,
        cardBillingDay,
        yearMonth,
    ]);

    const grouped = monthlyDerived.grouped;

    const visibleGrouped = useMemo(
        () => grouped.slice(0, visibleGroupCount),
        [grouped, visibleGroupCount],
    );

    const hasMoreGroups = visibleGroupCount < grouped.length;

    const swipeThresholds = useMemo(() => {
        if (swipeSensitivity === "high") {
            return {open: 44, close: 18, minHorizontal: 24};
        }
        if (swipeSensitivity === "low") {
            return {open: 68, close: 30, minHorizontal: 40};
        }
        return {open: 56, close: 24, minHorizontal: 32};
    }, [swipeSensitivity]);

    const pageKey = JSON.stringify([yearMonth, filter, methodFilter, billingFilter,
        periodMode, normalizedBaseDate, weekRange.start, weekRange.end,
        statementMonthFilter, activeTag, debouncedSearch, viewMode, sortOption, minAmountStr, maxAmountStr]);
    const [previousPageKey, setPreviousPageKey] = useState(pageKey);
    if (pageKey !== previousPageKey) {
        setPreviousPageKey(pageKey);
        setVisibleGroupCount(GROUP_PAGE_SIZE);
        setVisibleItemCountByDate({});
    }

    const tagSummary = monthlyDerived.tagSummary;
    const filteredIncome = monthlyDerived.filteredIncome;
    const filteredExpense = monthlyDerived.filteredExpense;
    const maxExpenseAmount = monthlyDerived.maxExpenseAmount;

    const isFiltered =
        filter !== "all" ||
        methodFilter !== "all" ||
        billingFilter !== "all" ||
        !!statementMonthFilter ||
        !!activeTag ||
        !!search ||
        !!minAmountStr ||
        !!maxAmountStr;

    const activeFilterCount =
        (filter !== "all" ? 1 : 0) +
        (methodFilter !== "all" ? 1 : 0) +
        (billingFilter !== "all" ? 1 : 0) +
        (statementMonthFilter ? 1 : 0) +
        (activeTag ? 1 : 0) +
        (search ? 1 : 0) +
        (minAmountStr || maxAmountStr ? 1 : 0);

    const [previousIsFiltered, setPreviousIsFiltered] = useState(isFiltered);
    if (isFiltered !== previousIsFiltered) {
        setPreviousIsFiltered(isFiltered);
        if (isFiltered) setIsActiveFiltersSectionOpen(true);
    }

    const methodSummary = monthlyDerived.methodSummary;

    const methodsNetTotal = useMemo(() => {
        return (["cash", "check", "credit", "transfer"] as const).reduce(
            (sum, method) =>
                sum +
                methodSummary[method].income -
                methodSummary[method].expense,
            0,
        );
    }, [methodSummary]);

    const insightSummary = useMemo<{
        topCat: [string, number];
        avgAmt: number;
        maxTx: Transaction;
    } | null>(() => {
        if (monthly.length < 3) return null;
        if (!monthlyDerived.maxExpenseTx || !monthlyDerived.topExpenseCategory)
            return null;

        return {
            topCat: monthlyDerived.topExpenseCategory,
            avgAmt: monthlyDerived.avgAmt,
            maxTx: monthlyDerived.maxExpenseTx,
        };
    }, [monthly.length, monthlyDerived]);

    const creditStatementMetaById = monthlyDerived.creditStatementMetaById;
    const resolvedMethodById = monthlyDerived.resolvedMethodById;

    const insightHeaderText = useMemo(() => {
        if (isFiltered && monthly.length > 0) return `${monthly.length}건`;
        if (insightSummary) return `최다 ${insightSummary.topCat[0]}`;
        return "요약 없음";
    }, [isFiltered, monthly.length, insightSummary]);

    const periodLabel =
        periodMode === "day" ? "일" : periodMode === "week" ? "주" : "월";

    function formatDate(dateStr: string) {
        const d = parseYmdLocal(dateStr);
        const days = ["일", "월", "화", "수", "목", "금", "토"];
        const today = toLocalDateStr();
        const yd = new Date();
        yd.setDate(yd.getDate() - 1);
        const yesterday = toLocalDateStr(yd);
        if (dateStr === today) return "오늘";
        if (dateStr === yesterday) return "어제";
        return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
    }

    function formatWeekRangeLabel(startDate: string, endDate: string) {
        const start = parseYmdLocal(startDate);
        const end = parseYmdLocal(endDate);
        return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (viewMode !== "list") return;
            const activeEl = document.activeElement as HTMLElement | null;
            const activeTag = activeEl?.tagName;
            const typingContext =
                activeTag === "INPUT" ||
                activeTag === "TEXTAREA" ||
                activeEl?.isContentEditable;

            if (e.key === "/" && !typingContext) {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            if (e.key === "Escape") {
                if (swipedId) {
                    e.preventDefault();
                    setSwipedId(null);
                    return;
                }
                if (search) {
                    e.preventDefault();
                    setSearch("");
                    searchInputRef.current?.blur();
                }
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [viewMode, search, swipedId]);

    function resetAllFilters() {
        setFilter("all");
        setMethodFilter("all");
        setBillingFilter("all");
        setStatementMonthFilter(null);
        setActiveTag(null);
        setSearch("");
        setMinAmountStr("");
        setMaxAmountStr("");
    }

    function handleTagClick(tag: string) {
        setActiveTag((prev) => (prev === tag ? null : tag));
    }

    function applyQuickPreset(preset: QuickFilterPreset) {
        setActiveTag(null);
        setSearch("");
        setStatementMonthFilter(null);

        if (preset === "all") {
            setFilter("all");
            setMethodFilter("all");
            setBillingFilter("all");
            return;
        }

        if (preset === "cash-expense") {
            setFilter("expense");
            setMethodFilter("cash");
            setBillingFilter("all");
            return;
        }

        if (preset === "check-expense") {
            setFilter("expense");
            setMethodFilter("check");
            setBillingFilter("all");
            return;
        }

        if (preset === "credit-current") {
            setFilter("expense");
            setMethodFilter("credit");
            setBillingFilter("current");
            return;
        }

        setFilter("expense");
        setMethodFilter("credit");
        setBillingFilter("next");
    }

    function isQuickPresetActive(preset: QuickFilterPreset): boolean {
        if (preset === "all") {
            return (
                filter === "all" &&
                methodFilter === "all" &&
                billingFilter === "all" &&
                !statementMonthFilter &&
                !activeTag &&
                !search
            );
        }
        if (preset === "cash-expense")
            return (
                filter === "expense" &&
                methodFilter === "cash" &&
                billingFilter === "all" &&
                !statementMonthFilter
            );
        if (preset === "check-expense")
            return (
                filter === "expense" &&
                methodFilter === "check" &&
                billingFilter === "all" &&
                !statementMonthFilter
            );
        if (preset === "credit-current")
            return (
                filter === "expense" &&
                methodFilter === "credit" &&
                billingFilter === "current" &&
                !statementMonthFilter
            );
        return (
            filter === "expense" &&
            methodFilter === "credit" &&
            billingFilter === "next" &&
            !statementMonthFilter
        );
    }

    return (
        <div className="space-y-3 tab-content">
            {/* 뷰 전환 + 내보내기 */}
            <div className="transaction-toolbar flex flex-wrap items-center gap-2">
                <div className="flex bg-surface rounded-2xl p-1 gap-1">
                    <button
                        onClick={() => setViewMode("list")}
                        aria-pressed={viewMode === "list"}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === "list"
                                ? "bg-action text-on-action "
                                : "text-muted hover:text-tone-gray"
                        }`}
                    >
                        <ListIcon size={13} /> 목록
                    </button>
                    <button
                        onClick={() => setViewMode("calendar")}
                        aria-pressed={viewMode === "calendar"}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === "calendar"
                                ? "bg-action text-on-action "
                                : "text-muted hover:text-tone-gray"
                        }`}
                    >
                        <CalendarDays size={13} /> 캘린더
                    </button>
                </div>
                <details ref={toolsRef} className="transaction-tools" onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        if (toolsRef.current) toolsRef.current.open = false;
                        toolsRef.current?.querySelector('summary')?.focus();
                    }
                }}>
                  <summary onClick={(event) => {
                      if (isSelectionMode) {
                          event.preventDefault();
                          setIsSelectionMode(false);
                          setSelectedIds(new Set());
                          if (toolsRef.current) toolsRef.current.open = false;
                      }
                  }}>{isSelectionMode ? '선택 취소' : '관리'} <ChevronDown size={14} aria-hidden="true" /></summary>
                  <div className="transaction-tools-options">
                    {onBulkDelete && (
                        <button
                            onClick={() => {
                                setIsSelectionMode((v) => !v);
                                setSelectedIds(new Set());
                                if (toolsRef.current) toolsRef.current.open = false;
                                toolsRef.current?.querySelector('summary')?.focus();
                            }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${isSelectionMode ? "bg-tone-blue/20 text-accent" : "bg-surface text-muted hover:text-white"}`}
                        >
                            <CheckSquare size={13} />{" "}
                            {isSelectionMode ? "취소" : "선택"}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setShowExport(true);
                            if (toolsRef.current) toolsRef.current.open = false;
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface text-muted hover:text-white text-xs font-bold transition-colors"
                    >
                        <FileDown size={13} /> 내보내기
                    </button>
                  </div>
                </details>
            </div>

            {/* 캘린더 뷰 */}
            {viewMode === "calendar" && (
                <CalendarView
                    transactions={transactions}
                    yearMonth={yearMonth}
                    onAddTransaction={onAddTransaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}

            {/* 목록 뷰 */}
            {
                viewMode === "list" && (
                    <>
                                    {/* 검색 */}
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            검색
                                        </p>
                                        <div role="search" className="relative">
                                            <Search
                                                size={16}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                                            />
                                            <input
                                                ref={searchInputRef}
                                                type="search"
                                                enterKeyHint="search"
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") event.currentTarget.blur();
                                                }}
                                                aria-label="내역 검색"
                                                aria-keyshortcuts="/ Escape"
                                                value={search}
                                                onChange={(e) =>
                                                    setSearch(e.target.value)
                                                }
                                                placeholder="카테고리, 설명, #태그로 검색"
                                                className="w-full bg-raised text-white placeholder-muted text-sm font-medium rounded-2xl pl-10 pr-10 py-3.5 focus:outline-none focus:ring-1 focus:ring-tone-blue/40"
                                            />
                                            {search !== debouncedSearch && (
                                                <div className="absolute right-10 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-tone-blue/30 border-t-[#3D8EF8] animate-spin" />
                                            )}
                                            {search && (
                                                <button
                                                    onClick={() =>
                                                        setSearch("")
                                                    }
                                                    aria-label="검색어 지우기"
                                                    className="absolute right-4 top-1/2 -translate-y-1/2"
                                                >
                                                    <X
                                                        size={14}
                                                        className="text-muted"
                                                    />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 px-1 mt-1.5 mb-1" role="group" aria-label="검색 범위">
                                            {([false, true] as const).map((all) => (
                                                <button
                                                    key={String(all)}
                                                    type="button"
                                                    aria-pressed={searchAllPeriods === all}
                                                    onClick={() => setSearchAllPeriods(all)}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${searchAllPeriods === all ? "bg-tone-blue/20 text-accent" : "bg-raised text-muted hover:text-fg"}`}
                                                >
                                                    {all ? "전체 기간" : "이번 달"}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="px-1 text-[11px] font-medium">
                                            {debouncedSearch ? (
                                                <>
                                                    <span className="text-accent font-bold">
                                                        {monthly.length}건
                                                    </span>
                                                    <span className="text-muted">
                                                        {" "}
                                                        검색됨 · Esc 초기화
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="search-shortcuts text-muted">
                                                    단축키: / 검색, Esc 초기화
                                                </span>
                                            )}
                                        </p>
                                    </div>


                        <section className="transaction-overview" aria-label="거래 빠른 필터">
                            <div className="transaction-quick-types" role="group" aria-label="거래 유형 필터">
                                {(['all', 'income', 'expense'] as FilterType[]).map((value) => (
                                    <button key={value} type="button" aria-pressed={filter === value}
                                        onClick={() => setFilter(value)}>
                                        {value === 'all' ? '전체' : value === 'income' ? '수입' : '지출'}
                                    </button>
                                ))}
                            </div>
                            <div className="transaction-result-summary" role="status" aria-live="polite" aria-atomic="true">
                                <span>{fmt(monthly.length)}건</span>
                                <span>수입 <strong className="text-income num">{fmt(filteredIncome)}원</strong></span>
                                <span>지출 <strong className="text-expense num">{fmt(filteredExpense)}원</strong></span>
                            </div>
                        </section>

                        <div className="bg-surface rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-3">
                                <button
                                    onClick={() =>
                                        setIsFilterPanelOpen((v) => !v)
                                    }
                                    aria-expanded={isFilterPanelOpen}
                                    aria-controls="transaction-filter-panel"
                                    className="flex-1 min-w-0 flex items-center justify-between px-2 py-0 text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-bold text-white">
                                            상세 필터
                                        </span>
                                        <span className="text-xs text-muted font-semibold shrink-0">
                                            {periodLabel} 단위
                                        </span>
                                        {activeFilterCount > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-action text-on-action leading-none shrink-0">
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </div>
                                    {isFilterPanelOpen ? (
                                        <ChevronUp
                                            size={14}
                                            className="text-muted shrink-0"
                                        />
                                    ) : (
                                        <ChevronDown
                                            size={14}
                                            className="text-muted shrink-0"
                                        />
                                    )}
                                </button>
                                {isFiltered && (
                                    <button
                                        onClick={resetAllFilters}
                                        className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-raised text-muted font-bold hover:text-white hover:bg-tone-hover transition-colors"
                                    >
                                        초기화
                                    </button>
                                )}
                            </div>

                            {isFilterPanelOpen && (
                                <div
                                    id="transaction-filter-panel"
                                    className="space-y-4 px-3 pb-4"
                                >
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            기간
                                        </p>
                                        <div className="bg-raised rounded-2xl p-2 space-y-2">
                                            <div className="flex gap-1">
                                                {(
                                                    [
                                                        {
                                                            key: "day",
                                                            label: "일",
                                                        },
                                                        {
                                                            key: "week",
                                                            label: "주",
                                                        },
                                                        {
                                                            key: "month",
                                                            label: "월",
                                                        },
                                                    ] as {
                                                        key: PeriodMode;
                                                        label: string;
                                                    }[]
                                                ).map((mode) => (
                                                    <button
                                                        key={mode.key}
                                                        onClick={() => {
                                                            setPeriodMode(
                                                                mode.key,
                                                            );
                                                            setBaseDate(
                                                                latestMonthDate,
                                                            );
                                                        }}
                                                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                                                            periodMode ===
                                                            mode.key
                                                                ? "bg-action text-on-action "
                                                                : "text-muted hover:text-tone-gray"
                                                        }`}
                                                    >
                                                        {mode.label} 단위
                                                    </button>
                                                ))}
                                            </div>

                                            {periodMode !== "month" && (
                                                <div className="flex items-center justify-between gap-2 px-1">
                                                    <div className="w-48 shrink-0">
                                                        <FancyDatePicker
                                                            value={
                                                                normalizedBaseDate
                                                            }
                                                            onChange={
                                                                setBaseDate
                                                            }
                                                            min={`${yearMonth}-01`}
                                                            max={monthLastDate}
                                                            size="sm"
                                                        />
                                                    </div>
                                                    {periodMode === "day" ? (
                                                        <span className="text-xs text-muted font-semibold">
                                                            선택한 하루만 표시
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted font-semibold">
                                                            {formatWeekRangeLabel(
                                                                weekRange.start,
                                                                weekRange.end,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            빠른 필터
                                        </p>
                                        <div className="bg-raised rounded-2xl p-1 grid grid-cols-3 gap-1">
                                            {(
                                                [
                                                    {key: "all", label: "전체"},
                                                    {
                                                        key: "credit-current",
                                                        label: "카드 이번",
                                                    },
                                                    {
                                                        key: "credit-next",
                                                        label: "카드 다음",
                                                    },
                                                    {
                                                        key: "cash-expense",
                                                        label: "현금 지출",
                                                    },
                                                    {
                                                        key: "check-expense",
                                                        label: "체크 지출",
                                                    },
                                                ] as {
                                                    key: QuickFilterPreset;
                                                    label: string;
                                                }[]
                                            ).map((preset) => {
                                                const active =
                                                    isQuickPresetActive(
                                                        preset.key,
                                                    );
                                                return (
                                                    <button
                                                        key={preset.key}
                                                        onClick={() =>
                                                            applyQuickPreset(
                                                                preset.key,
                                                            )
                                                        }
                                                        className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                                                            active
                                                                ? "bg-action text-on-action "
                                                                : "text-muted hover:text-fg hover:bg-tone-hover"
                                                        }`}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            정렬
                                        </p>
                                        <div className="bg-raised rounded-2xl p-1 grid grid-cols-2 gap-1">
                                            {(
                                                [
                                                    {
                                                        key: "date-desc",
                                                        label: "최신순",
                                                    },
                                                    {
                                                        key: "date-asc",
                                                        label: "오래된순",
                                                    },
                                                    {
                                                        key: "amount-desc",
                                                        label: "금액 높은순",
                                                    },
                                                    {
                                                        key: "amount-asc",
                                                        label: "금액 낮은순",
                                                    },
                                                ] as {
                                                    key: SortOption;
                                                    label: string;
                                                }[]
                                            ).map((option) => (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() =>
                                                        setSortOption(
                                                            option.key,
                                                        )
                                                    }
                                                    className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                                                        sortOption ===
                                                        option.key
                                                            ? "bg-action text-on-action "
                                                            : "text-muted hover:text-fg hover:bg-tone-hover"
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            금액 범위
                                        </p>
                                        <div className="bg-raised rounded-2xl p-2 flex items-center gap-2">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={minAmountStr}
                                                onChange={(e) =>
                                                    setMinAmountStr(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="최소 금액"
                                                aria-label="최소 금액"
                                                className="w-full min-w-0 bg-raised rounded-xl px-3 py-2 text-xs text-white placeholder-muted focus:outline-none num"
                                            />
                                            <span className="text-muted text-xs shrink-0">
                                                ~
                                            </span>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={maxAmountStr}
                                                onChange={(e) =>
                                                    setMaxAmountStr(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="최대 금액"
                                                aria-label="최대 금액"
                                                className="w-full min-w-0 bg-raised rounded-xl px-3 py-2 text-xs text-white placeholder-muted focus:outline-none num"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            제스처
                                        </p>
                                        <div className="bg-raised rounded-2xl p-2 space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-xs text-muted font-semibold">
                                                    스와이프 민감도
                                                </span>
                                                <span className="text-[11px] text-muted font-medium">
                                                    모바일 제스처
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                {(
                                                    [
                                                        {
                                                            key: "low",
                                                            label: "둔감",
                                                        },
                                                        {
                                                            key: "medium",
                                                            label: "보통",
                                                        },
                                                        {
                                                            key: "high",
                                                            label: "민감",
                                                        },
                                                    ] as {
                                                        key: SwipeSensitivity;
                                                        label: string;
                                                    }[]
                                                ).map((option) => (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        onClick={() =>
                                                            setSwipeSensitivity(
                                                                option.key,
                                                            )
                                                        }
                                                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                                                            swipeSensitivity ===
                                                            option.key
                                                                ? "bg-action text-on-action "
                                                                : "text-muted hover:text-fg hover:bg-tone-hover"
                                                        }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 필터 탭 */}
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">
                                            결제수단
                                        </p>
                                        <div className="bg-raised rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs text-muted font-semibold">
                                                    카드 결제일
                                                </span>
                                                <span className="text-xs text-accent font-bold">
                                                    매월 {cardBillingDay}일
                                                </span>
                                            </div>
                                            {!editingBillingDay ? (
                                                <button
                                                    onClick={() => {
                                                        setBillingDayInput(
                                                            String(
                                                                cardBillingDay,
                                                            ),
                                                        );
                                                        setEditingBillingDay(
                                                            true,
                                                        );
                                                    }}
                                                    className="text-[11px] px-2.5 py-1 rounded-lg bg-tone-blue/20 text-accent font-bold hover:bg-tone-blue/30 transition-colors"
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
                                                        onChange={(e) =>
                                                            setBillingDayInput(
                                                                e.target.value,
                                                            )
                                                        }
                                                        onFocus={(e) =>
                                                            e.target.select()
                                                        }
                                                        className="w-12 bg-surface text-white text-center rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-tone-blue/40"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            void handleSaveBillingDay();
                                                        }}
                                                        className="text-[11px] px-2 py-1 rounded-lg bg-action text-on-action font-bold"
                                                    >
                                                        저장
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setEditingBillingDay(
                                                                false,
                                                            )
                                                        }
                                                        className="text-[11px] px-2 py-1 rounded-lg bg-surface text-muted font-bold"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {statementMonthFilter && (
                                            <div className="bg-raised rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
                                                <span className="text-xs text-accent font-bold">
                                                    청구월 필터:{" "}
                                                    {statementMonthFilter}
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        setStatementMonthFilter(
                                                            null,
                                                        )
                                                    }
                                                    className="text-[11px] px-2.5 py-1 rounded-lg bg-surface text-muted font-bold hover:text-white hover:bg-tone-hover transition-colors"
                                                >
                                                    해제
                                                </button>
                                            </div>
                                        )}

                                        {userPaymentMethods.length > 0 ? (
                                            <div
                                                className={`bg-raised rounded-2xl p-1 ${userPaymentMethods.length > 4 ? "grid grid-cols-3 gap-1" : "flex"}`}
                                            >
                                                <button
                                                    onClick={() =>
                                                        setMethodFilter("all")
                                                    }
                                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${methodFilter === "all" ? "bg-action text-on-action " : "text-muted hover:text-tone-gray"}`}
                                                >
                                                    전체
                                                </button>
                                                {[...userPaymentMethods, ...(!userPaymentMethods.some(m => m.type === "transfer") ? [{ id: "transfer", type: "transfer" as const, label: "계좌이체" }] : [])].map((m) => {
                                                    const isSelected =
                                                        methodFilter === m.id;
                                                    return (
                                                        <button
                                                            key={m.id}
                                                            onClick={() =>
                                                                setMethodFilter(
                                                                    m.id,
                                                                )
                                                            }
                                                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all truncate px-1 ${
                                                                isSelected
                                                                    ? m.type ===
                                                                      "cash"
                                                                        ? "bg-tone-green/22 text-income"
                                                                        : m.type ===
                                                                            "check"
                                                                          ? "bg-tone-teal/22 text-tone-teal"
                                                                          : "bg-tone-blue/22 text-accent"
                                                                    : "text-muted hover:text-tone-gray"
                                                            }`}
                                                        >
                                                            {m.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="bg-raised rounded-2xl p-1 flex">
                                                {(
                                                    [
                                                        {
                                                            key: "all",
                                                            label: "결제수단 전체",
                                                        },
                                                        {
                                                            key: "cash",
                                                            label: "현금",
                                                        },
                                                        {
                                                            key: "check",
                                                            label: "체크카드",
                                                        },
                                                        {
                                                            key: "credit",
                                                            label: "신용카드",
                                                        },
                                                        { key: "transfer", label: "계좌이체" },
                                                    ] as {
                                                        key: MethodFilterType;
                                                        label: string;
                                                    }[]
                                                ).map((f) => (
                                                    <button
                                                        key={f.key}
                                                        onClick={() =>
                                                            setMethodFilter(
                                                                f.key,
                                                            )
                                                        }
                                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                                                            methodFilter ===
                                                            f.key
                                                                ? f.key ===
                                                                  "cash"
                                                                    ? "bg-tone-green/22 text-income"
                                                                    : f.key ===
                                                                        "check"
                                                                      ? "bg-tone-teal/22 text-tone-teal"
                                                                      : f.key ===
                                                                          "credit"
                                                                        ? "bg-tone-blue/22 text-accent"
                                                                        : "bg-action text-on-action "
                                                                : "text-muted hover:text-tone-gray"
                                                        }`}
                                                    >
                                                        {f.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div className="bg-raised rounded-2xl p-1 flex">
                                            {(
                                                [
                                                    {
                                                        key: "all",
                                                        label: "청구 전체",
                                                    },
                                                    {
                                                        key: "current",
                                                        label: "이번 청구",
                                                    },
                                                    {
                                                        key: "next",
                                                        label: "다음 청구",
                                                    },
                                                    {
                                                        key: "later",
                                                        label: "이후 청구",
                                                    },
                                                ] as {
                                                    key: BillingFilterType;
                                                    label: string;
                                                }[]
                                            ).map((f) => (
                                                <button
                                                    key={f.key}
                                                    onClick={() => {
                                                        setBillingFilter(f.key);
                                                        setStatementMonthFilter(
                                                            null,
                                                        );
                                                    }}
                                                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                                                        billingFilter === f.key
                                                            ? f.key ===
                                                              "current"
                                                                ? "bg-tone-amber/22 text-warning"
                                                                : f.key ===
                                                                    "next"
                                                                  ? "bg-tone-blue/22 text-accent"
                                                                  : f.key ===
                                                                      "later"
                                                                    ? "bg-tone-gray/22 text-muted"
                                                                    : "bg-action text-on-action "
                                                            : "text-muted hover:text-tone-gray"
                                                    }`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 결제수단별 잔액 */}
                        <div className="bg-surface rounded-2xl overflow-hidden">
                            <button
                                onClick={() =>
                                    setIsBalanceSectionOpen((v) => !v)
                                }
                                aria-expanded={isBalanceSectionOpen}
                                aria-controls="transaction-balance-section"
                                className="w-full flex items-center justify-between px-5 py-3 text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-bold text-white">
                                        결제수단별 잔액
                                    </span>
                                    <span
                                        className={`text-xs font-bold num ${methodsNetTotal > 0 ? "text-accent" : methodsNetTotal < 0 ? "text-tone-red-soft" : "text-muted"}`}
                                    >
                                        {methodsNetTotal >= 0 ? "+" : ""}
                                        {fmt(methodsNetTotal)}원
                                    </span>
                                </div>
                                {isBalanceSectionOpen ? (
                                    <ChevronUp
                                        size={14}
                                        className="text-muted shrink-0"
                                    />
                                ) : (
                                    <ChevronDown
                                        size={14}
                                        className="text-muted shrink-0"
                                    />
                                )}
                            </button>

                            {isBalanceSectionOpen && (
                                <div
                                    id="transaction-balance-section"
                                    className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 pb-3"
                                >
                                    {userPaymentMethods.length > 0
                                        ? (["cash", "check", "credit", "transfer"] as const)
                                              .filter(
                                                  (t) =>
                                                      t === "transfer" ||
                                                      userPaymentMethods.some(
                                                          (m) => m.type === t,
                                                      ),
                                              )
                                              .map((methodType) => {
                                                  const label =
                                                      userPaymentMethods.find(
                                                          (m) =>
                                                              m.type ===
                                                              methodType,
                                                      )?.label ??
                                                      PAYMENT_METHOD_LABEL[
                                                          methodType
                                                      ];
                                                  const income =
                                                      methodSummary[methodType]
                                                          .income;
                                                  const expense =
                                                      methodSummary[methodType]
                                                          .expense;
                                                  const net = income - expense;
                                                  return (
                                                      <div
                                                          key={methodType}
                                                          className="bg-raised rounded-2xl px-4 py-3"
                                                      >
                                                          <p className="text-[11px] text-muted font-semibold mb-1">
                                                              {label} 잔액
                                                          </p>
                                                          <p
                                                              className={`text-[15px] font-extrabold num ${net >= 0 ? "text-accent" : "text-expense"}`}
                                                          >
                                                              {net >= 0
                                                                  ? "+"
                                                                  : ""}
                                                              {fmt(net)}원
                                                          </p>
                                                          <p className="text-[10px] text-muted mt-1">
                                                              수입 +
                                                              {fmt(income)} /
                                                              지출 -
                                                              {fmt(expense)}
                                                          </p>
                                                      </div>
                                                  );
                                              })
                                        : (
                                              [
                                                  "cash",
                                                  "check",
                                                  "credit",
                                                  "transfer",
                                              ] as const
                                          ).map((method) => {
                                              const income =
                                                  methodSummary[method].income;
                                              const expense =
                                                  methodSummary[method].expense;
                                              const net = income - expense;
                                              return (
                                                  <div
                                                      key={method}
                                                      className="bg-raised rounded-2xl px-4 py-3"
                                                  >
                                                      <p className="text-[11px] text-muted font-semibold mb-1">
                                                          {
                                                              PAYMENT_METHOD_LABEL[
                                                                  method
                                                              ]
                                                          }{" "}
                                                          잔액
                                                      </p>
                                                      <p
                                                          className={`text-[15px] font-extrabold num ${net >= 0 ? "text-accent" : "text-expense"}`}
                                                      >
                                                          {net >= 0 ? "+" : ""}
                                                          {fmt(net)}원
                                                      </p>
                                                      <p className="text-[10px] text-muted mt-1">
                                                          수입 +{fmt(income)} /
                                                          지출 -{fmt(expense)}
                                                      </p>
                                                  </div>
                                              );
                                          })}
                                </div>
                            )}
                        </div>

                        {tagSummary.length > 0 && (
                            <div className="bg-surface rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-3.5">
                                    <button
                                        onClick={() =>
                                            setShowTagSummary((v) => !v)
                                        }
                                        aria-expanded={showTagSummary}
                                        aria-controls="transaction-tag-summary"
                                        className="flex items-center gap-2 flex-1 text-left"
                                    >
                                        <Hash
                                            size={14}
                                            className="text-accent"
                                        />
                                        <span className="text-sm font-bold text-white">
                                            태그별 합계
                                        </span>
                                        {activeTag && (
                                            <span className="text-xs px-2 py-0.5 rounded-lg bg-tone-blue/20 text-accent font-semibold">
                                                #{activeTag} 필터 중
                                            </span>
                                        )}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {onOpenTagManager && (
                                            <button
                                                onClick={onOpenTagManager}
                                                className="text-[11px] font-semibold text-muted hover:text-white px-2 py-1 rounded-lg bg-raised transition-colors"
                                            >
                                                관리
                                            </button>
                                        )}
                                        <button
                                            onClick={() =>
                                                setShowTagSummary((v) => !v)
                                            }
                                        >
                                            {showTagSummary ? (
                                                <ChevronUp
                                                    size={14}
                                                    className="text-muted"
                                                />
                                            ) : (
                                                <ChevronDown
                                                    size={14}
                                                    className="text-muted"
                                                />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {showTagSummary && (
                                    <div
                                        id="transaction-tag-summary"
                                        className="px-4 pb-4 space-y-1.5"
                                    >
                                        {tagSummary.map(([tag, stat]) => {
                                            const net =
                                                stat.income - stat.expense;
                                            const isActive = activeTag === tag;
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() =>
                                                        handleTagClick(tag)
                                                    }
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                                                        isActive
                                                            ? "bg-tone-blue/20 ring-1 ring-tone-blue/40"
                                                            : "bg-raised hover:bg-tone-hover"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-sm font-bold ${isActive ? "text-accent" : "text-white"}`}
                                                        >
                                                            #{tag}
                                                        </span>
                                                        <span className="text-xs text-muted font-medium">
                                                            {stat.count}건
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        {stat.income > 0 && (
                                                            <div className="text-xs font-bold text-income num">
                                                                +
                                                                {fmt(
                                                                    stat.income,
                                                                )}
                                                                원
                                                            </div>
                                                        )}
                                                        {stat.expense > 0 && (
                                                            <div className="text-xs font-bold text-expense num">
                                                                -
                                                                {fmt(
                                                                    stat.expense,
                                                                )}
                                                                원
                                                            </div>
                                                        )}
                                                        {stat.income > 0 &&
                                                            stat.expense >
                                                                0 && (
                                                                <div
                                                                    className={`text-[11px] font-bold num ${net >= 0 ? "text-accent" : "text-muted"}`}
                                                                >
                                                                    순{" "}
                                                                    {net >= 0
                                                                        ? "+"
                                                                        : ""}
                                                                    {fmt(net)}원
                                                                </div>
                                                            )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        {activeTag && (
                                            <button
                                                onClick={() =>
                                                    setActiveTag(null)
                                                }
                                                className="w-full text-xs font-bold text-muted hover:text-tone-gray py-1.5 transition-colors"
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
                            <div className="bg-surface rounded-2xl overflow-hidden">
                                <button
                                    onClick={() =>
                                        setIsActiveFiltersSectionOpen((v) => !v)
                                    }
                                    aria-expanded={isActiveFiltersSectionOpen}
                                    aria-controls="transaction-active-filters"
                                    className="w-full flex items-center justify-between px-5 py-3 text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-bold text-white">
                                            활성 필터 {activeFilterCount}개
                                        </span>
                                        <span className="text-xs text-muted font-semibold num">
                                            {fmt(monthly.length)}건
                                        </span>
                                    </div>
                                    {isActiveFiltersSectionOpen ? (
                                        <ChevronUp
                                            size={14}
                                            className="text-muted shrink-0"
                                        />
                                    ) : (
                                        <ChevronDown
                                            size={14}
                                            className="text-muted shrink-0"
                                        />
                                    )}
                                </button>

                                {isActiveFiltersSectionOpen && (
                                    <div
                                        id="transaction-active-filters"
                                        className="flex flex-wrap gap-1.5 px-4 pb-4"
                                    >
                                        {filter !== "all" && (
                                            <button
                                                onClick={() => setFilter("all")}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-blue/20 text-accent text-[11px] font-bold"
                                            >
                                                {filter === "income"
                                                    ? "수입"
                                                    : "지출"}{" "}
                                                <X size={10} />
                                            </button>
                                        )}
                                        {methodFilter !== "all" && (
                                            <button
                                                onClick={() =>
                                                    setMethodFilter("all")
                                                }
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-blue/20 text-accent text-[11px] font-bold"
                                            >
                                                {userPaymentMethods.find(
                                                    (m) =>
                                                        m.id === methodFilter,
                                                )?.label ??
                                                    PAYMENT_METHOD_LABEL[
                                                        methodFilter as
                                                            | "cash"
                                                            | "check"
                                                            | "credit"
                                                    ] ??
                                                    methodFilter}{" "}
                                                <X size={10} />
                                            </button>
                                        )}
                                        {billingFilter !== "all" && (
                                            <button
                                                onClick={() =>
                                                    setBillingFilter("all")
                                                }
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-amber/20 text-warning text-[11px] font-bold"
                                            >
                                                {billingFilter === "current"
                                                    ? "이번 청구"
                                                    : billingFilter === "next"
                                                      ? "다음 청구"
                                                      : "이후 청구"}{" "}
                                                <X size={10} />
                                            </button>
                                        )}
                                        {statementMonthFilter && (
                                            <button
                                                onClick={() =>
                                                    setStatementMonthFilter(
                                                        null,
                                                    )
                                                }
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-blue/20 text-accent text-[11px] font-bold"
                                            >
                                                청구월 {statementMonthFilter}{" "}
                                                <X size={10} />
                                            </button>
                                        )}
                                        {activeTag && (
                                            <button
                                                onClick={() =>
                                                    setActiveTag(null)
                                                }
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-blue/20 text-accent text-[11px] font-bold"
                                            >
                                                #{activeTag} <X size={10} />
                                            </button>
                                        )}
                                        {search && (
                                            <button
                                                onClick={() => setSearch("")}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-raised text-muted text-[11px] font-bold"
                                            >
                                                "{search}" <X size={10} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {(isFiltered && monthly.length > 0) ||
                        insightSummary ? (
                            <div className="bg-surface rounded-2xl overflow-hidden">
                                <button
                                    onClick={() =>
                                        setIsInsightsSectionOpen((v) => !v)
                                    }
                                    aria-expanded={isInsightsSectionOpen}
                                    aria-controls="transaction-insights-section"
                                    className="w-full flex items-center justify-between px-5 py-3 text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-bold text-white">
                                            요약 인사이트
                                        </span>
                                        <span className="text-xs text-muted font-semibold truncate">
                                            {insightHeaderText}
                                        </span>
                                    </div>
                                    {isInsightsSectionOpen ? (
                                        <ChevronUp
                                            size={14}
                                            className="text-muted shrink-0"
                                        />
                                    ) : (
                                        <ChevronDown
                                            size={14}
                                            className="text-muted shrink-0"
                                        />
                                    )}
                                </button>

                                {isInsightsSectionOpen && (
                                    <div
                                        id="transaction-insights-section"
                                        className="space-y-2 px-3 pb-3"
                                    >
                                        {/* 필터 결과 합계 */}
                                        {isFiltered && monthly.length > 0 && (
                                            <div className="bg-raised rounded-2xl px-4 py-3 flex items-center justify-between">
                                                <span className="text-xs text-muted font-semibold">
                                                    {monthly.length}건
                                                </span>
                                                <div className="flex gap-3">
                                                    {filteredIncome > 0 && (
                                                        <span className="text-xs font-bold text-income num">
                                                            +
                                                            {fmt(
                                                                filteredIncome,
                                                            )}
                                                        </span>
                                                    )}
                                                    {filteredExpense > 0 && (
                                                        <span className="text-xs font-bold text-expense num">
                                                            -
                                                            {fmt(
                                                                filteredExpense,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {insightSummary && (
                                            <div className="flex gap-2 mb-1">
                                                <div className="flex-1 bg-raised rounded-2xl px-3 py-2.5">
                                                    <p className="text-[9px] text-muted mb-1">
                                                        최다 지출
                                                    </p>
                                                    <p className="text-[11px] font-bold text-white truncate">
                                                        {CATEGORY_EMOJI[
                                                            insightSummary
                                                                .topCat[0]
                                                        ] ?? "📦"}{" "}
                                                        {
                                                            insightSummary
                                                                .topCat[0]
                                                        }
                                                    </p>
                                                    <p className="text-[9px] num text-expense">
                                                        {fmt(
                                                            insightSummary
                                                                .topCat[1],
                                                        )}
                                                        원
                                                    </p>
                                                </div>
                                                <div className="flex-1 bg-raised rounded-2xl px-3 py-2.5">
                                                    <p className="text-[9px] text-muted mb-1">
                                                        평균 거래
                                                    </p>
                                                    <p className="text-[12px] font-bold num text-white">
                                                        {fmt(
                                                            insightSummary.avgAmt,
                                                        )}
                                                    </p>
                                                    <p className="text-[9px] text-muted">
                                                        원/건
                                                    </p>
                                                </div>
                                                <div className="flex-1 bg-raised rounded-2xl px-3 py-2.5">
                                                    <p className="text-[9px] text-muted mb-1">
                                                        최대 단건
                                                    </p>
                                                    <p className="text-[11px] font-bold text-white truncate">
                                                        {CATEGORY_EMOJI[
                                                            insightSummary.maxTx
                                                                .category
                                                        ] ?? "📦"}{" "}
                                                        {
                                                            insightSummary.maxTx
                                                                .category
                                                        }
                                                    </p>
                                                    <p className="text-[9px] num text-expense">
                                                        {fmt(
                                                            insightSummary.maxTx
                                                                .amount,
                                                        )}
                                                        원
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {grouped.length === 0 ? (
                            <div className="bg-surface rounded-2xl">
                                <EmptyState
                                    emoji={search || activeTag ? "🔍" : "📋"}
                                    title={
                                        activeTag
                                            ? `#${activeTag} 태그 내역 없음`
                                            : search
                                              ? `"${search}" 검색 결과 없음`
                                              : "내역이 없어요"
                                    }
                                    description={
                                        !search &&
                                        !activeTag &&
                                        filter === "all" &&
                                        methodFilter === "all" &&
                                        billingFilter === "all" &&
                                        !statementMonthFilter
                                            ? "내역 추가 버튼으로 첫 내역을 입력해보세요"
                                            : "조건을 바꾸거나 필터를 초기화해보세요"
                                    }
                                    action={
                                        filter !== "all" ||
                                        methodFilter !== "all" ||
                                        billingFilter !== "all" ||
                                        statementMonthFilter !== null ||
                                        !!activeTag ||
                                        !!search
                                            ? {
                                                  label: "필터 전체 초기화",
                                                  onClick: resetAllFilters,
                                              }
                                            : onAddTransaction
                                              ? {
                                                    label: "내역 추가",
                                                    onClick: onAddTransaction,
                                                }
                                              : undefined
                                    }
                                />
                            </div>
                        ) : (
                            visibleGrouped.map(
                                ({
                                    date,
                                    list,
                                    income: dayIncome,
                                    expense: dayExpense,
                                    balance: dayBalance,
                                }) => {
                                    const visibleItemCount =
                                        visibleItemCountByDate[date] ??
                                        ITEM_PAGE_SIZE;
                                    const visibleItems = list.slice(
                                        0,
                                        visibleItemCount,
                                    );
                                    const hasMoreItemsInDate =
                                        visibleItemCount < list.length;
                                    return (
                                        <div
                                            key={date}
                                            className="bg-surface rounded-2xl overflow-hidden"
                                        >
                                            {/* 날짜 헤더 */}
                                            <button
                                                className="w-full flex items-center justify-between px-5 pt-4 pb-3 text-left"
                                                aria-expanded={
                                                    !collapsedGroups.has(date)
                                                }
                                                aria-controls={`group-${date}`}
                                                onClick={() =>
                                                    setCollapsedGroups(
                                                        (prev) => {
                                                            const next =
                                                                new Set(prev);
                                                            if (next.has(date))
                                                                next.delete(
                                                                    date,
                                                                );
                                                            else next.add(date);
                                                            return next;
                                                        },
                                                    )
                                                }
                                            >
                                                <span className="text-sm font-bold text-white">
                                                    {formatDate(date)}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {dayIncome > 0 && (
                                                        <span className="text-[11px] font-bold num text-income">
                                                            +{fmt(dayIncome)}
                                                        </span>
                                                    )}
                                                    {dayExpense > 0 && (
                                                        <span className="text-[11px] font-bold num text-expense">
                                                            -{fmt(dayExpense)}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-[11px] font-bold num pl-1 border-l border-white/10 ${dayBalance >= 0 ? "text-accent" : "text-expense"}`}
                                                    >
                                                        {dayBalance >= 0
                                                            ? "+"
                                                            : ""}
                                                        {fmt(dayBalance)}
                                                    </span>
                                                    <ChevronDown
                                                        size={13}
                                                        className={`text-muted transition-transform duration-200 shrink-0 ${collapsedGroups.has(date) ? "-rotate-90" : ""}`}
                                                    />
                                                </div>
                                            </button>

                                            {!collapsedGroups.has(date) && (
                                                <div id={`group-${date}`}>
                                                    {visibleItems.map(
                                                        (t, idx) => {
                                                            const color =
                                                                CATEGORY_COLOR[
                                                                    t.category
                                                                ] ?? {
                                                                    bg: "rgba(139,149,161,0.12)",
                                                                    text: "#8B95A1",
                                                                };
                                                            const tags =
                                                                t.tags ?? [];
                                                            const isSwiped =
                                                                swipedId ===
                                                                t.id;
                                                            const isFirstEverItem =
                                                                !swipeHintSeen &&
                                                                idx === 0;
                                                            return (
                                                                <div
                                                                    key={t.id}
                                                                    className={`relative overflow-hidden list-item-enter ${idx < visibleItems.length - 1 ? "border-b border-[rgba(255,255,255,0.05)]" : ""}`}
                                                                    style={{
                                                                        animationDelay: `${Math.min(idx, 9) * 30}ms`,
                                                                        borderLeft:
                                                                            t.type ===
                                                                                "expense" &&
                                                                            maxExpenseAmount >
                                                                                0
                                                                                ? `3px solid rgba(242,82,96,${(0.25 + (t.amount / maxExpenseAmount) * 0.75).toFixed(2)})`
                                                                                : undefined,
                                                                    }}
                                                                >
                                                                    {/* 스와이프 힌트 (첫 방문 시) */}
                                                                    {isFirstEverItem &&
                                                                        !isSwiped && (
                                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10 animate-pulse pointer-events-none">
                                                                                <span className="text-[10px] font-bold text-muted bg-raised px-2 py-1 rounded-lg">
                                                                                    ←
                                                                                    스와이프로
                                                                                    편집/삭제
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    {/* 스와이프 액션 패널 */}
                                                                    <div
                                                                        className={`absolute right-0 top-0 bottom-0 flex items-center gap-1 px-3 transition-all duration-200 ${isSwiped ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                                                                    >
                                                                        <button
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                onEdit(
                                                                                    t,
                                                                                );
                                                                                setSwipedId(
                                                                                    null,
                                                                                );
                                                                            }}
                                                                            className="w-11 h-11 rounded-xl bg-tone-blue/20 flex items-center justify-center text-accent"
                                                                        >
                                                                            <Pencil
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        </button>
                                                                        <button
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteWithUndo(
                                                                                    t.id,
                                                                                );
                                                                            }}
                                                                            className="w-11 h-11 rounded-xl bg-tone-red/20 flex items-center justify-center text-expense"
                                                                        >
                                                                            <Trash2
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        </button>
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            transform:
                                                                                isSwiped
                                                                                    ? "translateX(-88px)"
                                                                                    : "translateX(0)",
                                                                            transition:
                                                                                "transform 0.2s ease",
                                                                        }}
                                                                        role="button"
                                                                        tabIndex={
                                                                            0
                                                                        }
                                                                        onClick={() => {
                                                                            if (
                                                                                isSelectionMode
                                                                            ) {
                                                                                setSelectedIds(
                                                                                    (
                                                                                        prev,
                                                                                    ) => {
                                                                                        const next =
                                                                                            new Set(
                                                                                                prev,
                                                                                            );
                                                                                        if (next.has(t.id)) next.delete(t.id);
                                                                                        else next.add(t.id);
                                                                                        return next;
                                                                                    },
                                                                                );
                                                                                return;
                                                                            }
                                                                            setSwipedId(
                                                                                null,
                                                                            );
                                                                            if (
                                                                                !isSwiped
                                                                            )
                                                                                setDetailTransaction(
                                                                                    t,
                                                                                );
                                                                        }}
                                                                        onKeyDown={(
                                                                            e,
                                                                        ) => {
                                                                            if (
                                                                                e.key !==
                                                                                    "Enter" &&
                                                                                e.key !==
                                                                                    " "
                                                                            )
                                                                                return;
                                                                            e.preventDefault();
                                                                            if (
                                                                                isSelectionMode
                                                                            ) {
                                                                                setSelectedIds(
                                                                                    (
                                                                                        prev,
                                                                                    ) => {
                                                                                        const next =
                                                                                            new Set(
                                                                                                prev,
                                                                                            );
                                                                                        if (next.has(t.id)) next.delete(t.id);
                                                                                        else next.add(t.id);
                                                                                        return next;
                                                                                    },
                                                                                );
                                                                                return;
                                                                            }
                                                                            setSwipedId(
                                                                                null,
                                                                            );
                                                                            if (
                                                                                !isSwiped
                                                                            )
                                                                                setDetailTransaction(
                                                                                    t,
                                                                                );
                                                                        }}
                                                                        onTouchStart={(
                                                                            e,
                                                                        ) => {
                                                                            if (
                                                                                isSelectionMode
                                                                            )
                                                                                return;
                                                                            touchStartX.current =
                                                                                e.touches[0].clientX;
                                                                            touchStartY.current =
                                                                                e.touches[0].clientY;
                                                                        }}
                                                                        onTouchEnd={(
                                                                            e,
                                                                        ) => {
                                                                            if (
                                                                                isSelectionMode
                                                                            )
                                                                                return;
                                                                            const deltaX =
                                                                                e
                                                                                    .changedTouches[0]
                                                                                    .clientX -
                                                                                touchStartX.current;
                                                                            const deltaY =
                                                                                e
                                                                                    .changedTouches[0]
                                                                                    .clientY -
                                                                                touchStartY.current;
                                                                            const absX =
                                                                                Math.abs(
                                                                                    deltaX,
                                                                                );
                                                                            const absY =
                                                                                Math.abs(
                                                                                    deltaY,
                                                                                );

                                                                            // 세로 스크롤 제스처는 스와이프로 처리하지 않는다.
                                                                            if (
                                                                                absY >
                                                                                absX
                                                                            )
                                                                                return;
                                                                            if (
                                                                                absX <
                                                                                swipeThresholds.minHorizontal
                                                                            )
                                                                                return;

                                                                            if (
                                                                                deltaX <
                                                                                -swipeThresholds.open
                                                                            ) {
                                                                                setSwipedId(
                                                                                    t.id,
                                                                                );
                                                                                if (
                                                                                    !swipeHintSeen
                                                                                ) {
                                                                                    setSwipeHintSeen(
                                                                                        true,
                                                                                    );
                                                                                    localStorage.setItem(
                                                                                        "hb_swipe_hint_seen",
                                                                                        "1",
                                                                                    );
                                                                                }
                                                                            } else if (
                                                                                deltaX >
                                                                                swipeThresholds.close
                                                                            )
                                                                                setSwipedId(
                                                                                    null,
                                                                                );
                                                                        }}
                                                                        className="transaction-entry-row flex items-center gap-3 px-5 py-3.5 group cursor-pointer hover:bg-white/2 transition-colors bg-surface"
                                                                    >
                                                                        {isSelectionMode && (
                                                                            <div className="shrink-0 text-accent">
                                                                                {selectedIds.has(
                                                                                    t.id,
                                                                                ) ? (
                                                                                    <CheckSquare
                                                                                        size={
                                                                                            20
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <Square
                                                                                        size={
                                                                                            20
                                                                                        }
                                                                                        className="text-muted"
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <div
                                                                            className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    color.bg,
                                                                            }}
                                                                        >
                                                                            <CategoryIcon category={t.category} />
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <HighlightText
                                                                                text={
                                                                                    t.category
                                                                                }
                                                                                query={
                                                                                    debouncedSearch
                                                                                }
                                                                                className="text-[14px] font-semibold text-white leading-tight block"
                                                                            />
                                                                            {t.description && (
                                                                                <HighlightText
                                                                                    text={
                                                                                        t.description
                                                                                    }
                                                                                    query={
                                                                                        debouncedSearch
                                                                                    }
                                                                                    className="text-xs text-muted truncate mt-0.5 block"
                                                                                />
                                                                            )}
                                                                            {(() => {
                                                                                const resolved =
                                                                                    resolvedMethodById.get(
                                                                                        t.id,
                                                                                    ) ??
                                                                                    resolvePaymentMethod(
                                                                                        t,
                                                                                        userPaymentMethods,
                                                                                    );
                                                                                const emoji = <PaymentMethodIcon method={resolved.type} size={12} />;
                                                                                return (
                                                                                    <span
                                                                                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] mt-1 font-bold ${
                                                                                            resolved.type ===
                                                                                            "credit"
                                                                                                ? "bg-tone-blue/18 text-accent"
                                                                                                : resolved.type ===
                                                                                                    "check"
                                                                                                  ? "bg-tone-teal/20 text-tone-teal"
                                                                                                  : "bg-tone-green/18 text-income"
                                                                                        }`}
                                                                                    >
                                                                                        {
                                                                                            emoji
                                                                                        }{" "}
                                                                                        {
                                                                                            resolved.label
                                                                                        }
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            {(() => {
                                                                                const meta =
                                                                                    creditStatementMetaById.get(
                                                                                        t.id,
                                                                                    );
                                                                                if (
                                                                                    !meta
                                                                                )
                                                                                    return null;
                                                                                return (
                                                                                    <span
                                                                                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] mt-1 ml-1 font-bold ${
                                                                                            meta.stage ===
                                                                                            "current"
                                                                                                ? "bg-tone-amber/20 text-warning"
                                                                                                : meta.stage ===
                                                                                                    "next"
                                                                                                  ? "bg-tone-blue/20 text-accent"
                                                                                                  : "bg-tone-gray/20 text-muted"
                                                                                        }`}
                                                                                        title={`결제일 ${meta.txBillingDay}일 기준 · ${meta.statementYM} 청구`}
                                                                                        onClick={(
                                                                                            e,
                                                                                        ) => {
                                                                                            e.stopPropagation();
                                                                                            setStatementMonthFilter(
                                                                                                meta.statementYM,
                                                                                            );
                                                                                            setMethodFilter(
                                                                                                "credit",
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        {meta.stage ===
                                                                                        "current"
                                                                                            ? "이번 청구"
                                                                                            : meta.stage ===
                                                                                                "next"
                                                                                              ? "다음 청구"
                                                                                              : `${meta.statementYM.slice(5)}월 청구`}
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            {t.dateEnd && (
                                                                                <p className="text-[10px] text-accent font-semibold mt-0.5">
                                                                                    ~{" "}
                                                                                    {(() => {
                                                                                        const [
                                                                                            ,
                                                                                            m,
                                                                                            d,
                                                                                        ] =
                                                                                            t.dateEnd.split(
                                                                                                "-",
                                                                                            );
                                                                                        return `${parseInt(m)}.${d}`;
                                                                                    })()}
                                                                                    까지
                                                                                </p>
                                                                            )}
                                                                            {tags.length >
                                                                                0 && (
                                                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                                                    {tags.map(
                                                                                        (
                                                                                            tag,
                                                                                        ) => (
                                                                                            <button
                                                                                                key={
                                                                                                    tag
                                                                                                }
                                                                                                onClick={(
                                                                                                    e,
                                                                                                ) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleTagClick(
                                                                                                        tag,
                                                                                                    );
                                                                                                }}
                                                                                                className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                                                                                                    activeTag ===
                                                                                                    tag
                                                                                                        ? "bg-tone-blue/30 text-accent"
                                                                                                        : "bg-raised text-accent hover:bg-tone-blue/15 hover:text-tone-blue"
                                                                                                }`}
                                                                                            >
                                                                                                #
                                                                                                <HighlightText
                                                                                                    text={
                                                                                                        tag
                                                                                                    }
                                                                                                    query={
                                                                                                        debouncedSearch
                                                                                                    }
                                                                                                />
                                                                                            </button>
                                                                                        ),
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <span
                                                                                className="text-[14px] font-bold num"
                                                                                style={{
                                                                                    color:
                                                                                        t.type ===
                                                                                        "income"
                                                                                            ? "#2ACF6A"
                                                                                            : "#FF8D98",
                                                                                }}
                                                                            >
                                                                                {t.type ===
                                                                                "income"
                                                                                    ? "+"
                                                                                    : "-"}
                                                                                {fmt(
                                                                                    t.amount,
                                                                                )}
                                                                                원
                                                                            </span>

                                                                            {/* 영수증 아이콘 */}
                                                                            {t.receiptImageUrl && (
                                                                                <button
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        setReceiptModal(
                                                                                            {
                                                                                                open: true,
                                                                                                url: t.receiptImageUrl!,
                                                                                            },
                                                                                        );
                                                                                    }}
                                                                                    className="p-1.5 rounded-xl hover:bg-tone-blue/15 text-accent transition-colors"
                                                                                    title="영수증 보기"
                                                                                >
                                                                                    📷
                                                                                </button>
                                                                            )}

                                                                            <div className="flex gap-0.5 ml-1">
                                                                                <button
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        onEdit(
                                                                                            t,
                                                                                        );
                                                                                    }}
                                                                                    aria-label={`${t.category} 내역 수정`}
                                                                                    className="p-2.5 rounded-xl hover:bg-tone-blue/15 text-muted hover:text-tone-blue transition-colors"
                                                                                >
                                                                                    <Pencil
                                                                                        size={
                                                                                            15
                                                                                        }
                                                                                    />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteWithUndo(
                                                                                            t.id,
                                                                                        );
                                                                                    }}
                                                                                    aria-label={`${t.category} 내역 삭제`}
                                                                                    className="p-2.5 rounded-xl hover:bg-tone-red/15 text-muted hover:text-tone-red transition-colors"
                                                                                >
                                                                                    <Trash2
                                                                                        size={
                                                                                            15
                                                                                        }
                                                                                    />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}

                                                    {hasMoreItemsInDate && (
                                                        <div className="px-4 pb-3 pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setVisibleItemCountByDate(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            [date]:
                                                                                (prev[
                                                                                    date
                                                                                ] ??
                                                                                    ITEM_PAGE_SIZE) +
                                                                                ITEM_PAGE_SIZE,
                                                                        }),
                                                                    )
                                                                }
                                                                className="w-full py-2 rounded-xl bg-raised text-muted hover:text-white text-xs font-bold transition-colors"
                                                            >
                                                                이 날짜 내역 더
                                                                보기 (
                                                                {
                                                                    visibleItems.length
                                                                }
                                                                /{list.length})
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                },
                            )
                        )}

                        {viewMode === "list" && hasMoreGroups && (
                            <div className="flex justify-center pt-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setVisibleGroupCount(
                                            (prev) => prev + GROUP_PAGE_SIZE,
                                        )
                                    }
                                    className="px-4 py-2 rounded-xl bg-surface text-muted hover:text-white text-xs font-bold transition-colors"
                                >
                                    내역 더 보기 ({visibleGrouped.length}/
                                    {grouped.length})
                                </button>
                            </div>
                        )}
                    </>
                ) /* end list view */
            }

            {/* 일괄 액션바 */}
            {isSelectionMode && selectedIds.size > 0 && (
                <div className="transaction-bulk-bar fixed left-0 right-0 flex justify-center z-40 px-4">
                    <div className="flex items-center gap-3 bg-surface border border-white/10 rounded-3xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                        <span className="text-white font-bold text-sm">
                            {selectedIds.size}개 선택됨
                        </span>
                        {onBulkEdit && (
                            <button
                                onClick={() => setShowBulkCategoryPicker(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-tone-blue/20 text-accent font-bold text-sm"
                            >
                                카테고리
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (onBulkDelete)
                                    onBulkDelete([...selectedIds]);
                                setIsSelectionMode(false);
                                setSelectedIds(new Set());
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-tone-red/20 text-expense font-bold text-sm"
                        >
                            <Trash2 size={14} /> 삭제
                        </button>
                    </div>
                </div>
            )}

            {/* 일괄 카테고리 변경 */}
            {showBulkCategoryPicker && (
                <InlineDialog
                    onClose={() => setShowBulkCategoryPicker(false)}
                    label="카테고리 변경"
                    containerClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
                    panelClassName="relative w-full max-w-lg bg-surface rounded-t-[28px] px-5 pt-5 pb-8"
                >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[17px] font-bold text-white">
                                    카테고리 변경
                                </p>
                                <p className="text-[12px] text-muted mt-0.5">
                                    {selectedIds.size}개 내역에 적용
                                </p>
                            </div>
                            <button
                                onClick={() => setShowBulkCategoryPicker(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-raised"
                            >
                                <X size={16} className="text-muted" />
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1">
                            {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(
                                (cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            if (onBulkEdit)
                                                onBulkEdit(
                                                    [...selectedIds],
                                                    cat,
                                                );
                                            setShowBulkCategoryPicker(false);
                                            setIsSelectionMode(false);
                                            setSelectedIds(new Set());
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-raised hover:bg-tone-hover text-left transition-colors"
                                    >
                                        <span className="text-base">
                                            {CATEGORY_EMOJI[cat] ?? "📦"}
                                        </span>
                                        <span className="text-sm font-semibold text-white">
                                            {cat}
                                        </span>
                                    </button>
                                ),
                            )}
                        </div>
                </InlineDialog>
            )}

            {/* 내역 상세 모달 */}
            {detailTransaction && (
                <TransactionDetailModal
                    transaction={detailTransaction}
                    userPaymentMethods={userPaymentMethods}
                    onEdit={(t) => {
                        setDetailTransaction(null);
                        onEdit(t);
                    }}
                    onDelete={(id) => {
                        setDetailTransaction(null);
                        handleDeleteWithUndo(id);
                    }}
                    onClose={() => setDetailTransaction(null)}
                />
            )}

            {/* 영수증 모달 */}
            {receiptModal.open && (
                <InlineDialog
                    onClose={() => setReceiptModal({open: false, url: ""})}
                    label="영수증"
                    containerClassName="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                >
                    <img
                        src={receiptModal.url}
                        alt="영수증"
                        className="max-w-full max-h-[90vh] rounded-2xl"
                    />
                </InlineDialog>
            )}

            {showExport && (
                <ExportModal
                    transactions={transactions}
                    yearMonth={yearMonth}
                    onClose={() => setShowExport(false)}
                    onArchiveDone={(transactionIds) => {
                        setShowExport(false);
                        onArchiveDone?.(transactionIds);
                    }}
                />
            )}
        </div>
    );
}
