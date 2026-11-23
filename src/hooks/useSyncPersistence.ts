import { useCallback, useEffect, useRef, useState } from "react";
import { discardPendingSync, hasPendingSync as hasPendingSyncRecord, isStorageConflictError } from "../lib/storage";
import type { RemoteVersionKey } from "../lib/storage";
import { showToast } from "../lib/toast";

const CONFLICT_SCOPE_PREF_KEY = "hb_conflict_scope_pref";
const CONFLICT_POLICY_REMEMBER_KEY = "hb_conflict_policy_remember";
const LAST_SYNC_SUCCESS_AT_KEY = "hb_last_sync_success_at";
function parseConflictScopePreference(): RemoteVersionKey[] {
    try {
        const raw = localStorage.getItem(CONFLICT_SCOPE_PREF_KEY);
        if (!raw)
            return [
                "transactions",
                "memos",
                "budgets",
                "recurring",
                "subscriptions",
                "goals",
            ];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [
                "transactions",
                "memos",
                "budgets",
                "recurring",
                "subscriptions",
                "goals",
            ];
        const allowed: RemoteVersionKey[] = [
            "transactions",
            "memos",
            "budgets",
            "recurring",
            "subscriptions",
            "goals",
            "settings",
        ];
        const result = parsed.filter((item): item is RemoteVersionKey =>
            allowed.includes(item as RemoteVersionKey),
        );
        return result.length > 0
            ? result
            : [
                  "transactions",
                  "memos",
                  "budgets",
                  "recurring",
                  "subscriptions",
                  "goals",
              ];
    } catch {
        return [
            "transactions",
            "memos",
            "budgets",
            "recurring",
            "subscriptions",
            "goals",
        ];
    }
}

function parseConflictPolicyRemember(): boolean {
    const raw = localStorage.getItem(CONFLICT_POLICY_REMEMBER_KEY);
    if (raw === "0") return false;
    return true;
}

export function getDefaultSelectedConflictKeys(
    keys: RemoteVersionKey[],
    preferredScopes: RemoteVersionKey[],
): RemoteVersionKey[] {
    const preferred = keys.filter((key) => preferredScopes.includes(key));
    if (preferred.length > 0) return preferred;
    if (keys.length <= 1) return keys;
    const withoutSettings = keys.filter((key) => key !== "settings");
    return withoutSettings.length > 0 ? withoutSettings : keys;
}
export function scopeLabel(scope: RemoteVersionKey): string {
    const labels: Record<RemoteVersionKey, string> = {
        transactions: "거래내역",
        memos: "메모",
        budgets: "예산",
        recurring: "반복거래",
        subscriptions: "구독",
        goals: "목표",
        settings: "설정",
    };
    return labels[scope];
}
export interface FailedPersistTask {
    id: string;
    message: string;
    run: () => Promise<void>;
    scope: RemoteVersionKey;
    attempts: number;
    lastFailedAt: number;
}

export type ConflictVersionDiff = Partial<
    Record<RemoteVersionKey, {expected: number; remote: number}>
>;
export type ConflictCountDiff = Partial<
    Record<
        RemoteVersionKey,
        {localCount: number | null; remoteCount: number | null}
    >
>;
export type RetryReasonCode = "conflict" | "save-failed";
export type RetryRunMode = "all" | "conflict-only" | "save-failed-only";

export interface RetryResultSummary {
    attempted: number;
    succeeded: number;
    failed: number;
    mode: RetryRunMode;
    finishedAt: number;
    failedByScope: Array<{scope: RemoteVersionKey; count: number}>;
}

interface UseSyncPersistenceParams {
    hydrateData: () => Promise<void>;
}

/**
 * 원격 저장(persist)·실패 재시도·저장 충돌 처리와 온라인/동기화 상태를 한곳에서 관리한다.
 * App.tsx에서 이름을 바꾸지 않고 옮겨 왔다.
 */
export function useSyncPersistence({ hydrateData }: UseSyncPersistenceParams) {
    const persistInFlightRef = useRef(0);
    // 오프라인 / 미동기화 상태
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [hasPendingSync, setHasPendingSync] = useState(
        () => hasPendingSyncRecord(),
    );
    const [failedPersistTasks, setFailedPersistTasks] = useState<
        FailedPersistTask[]
    >([]);
    const [lastRetryReasons, setLastRetryReasons] = useState<
        Partial<Record<RemoteVersionKey, RetryReasonCode[]>>
    >({});
    const [isRetryingPersist, setIsRetryingPersist] = useState(false);
    const [retryProgress, setRetryProgress] = useState<{
        done: number;
        total: number;
    } | null>(null);
    const [lastRetryResult, setLastRetryResult] =
        useState<RetryResultSummary | null>(null);
    const [lastSyncSuccessAt, setLastSyncSuccessAt] = useState<number | null>(
        () => {
            const raw = localStorage.getItem(LAST_SYNC_SUCCESS_AT_KEY);
            if (!raw) return null;
            const parsed = Number(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        },
    );
    const [showSyncStatusDetails, setShowSyncStatusDetails] = useState(false);
    const [showSyncConflictModal, setShowSyncConflictModal] = useState(false);
    const [showSyncRecoveryGuideModal, setShowSyncRecoveryGuideModal] =
        useState(false);
    const [conflictKeys, setConflictKeys] = useState<RemoteVersionKey[]>([]);
    const [selectedConflictKeys, setSelectedConflictKeys] = useState<
        RemoteVersionKey[]
    >([]);
    const [conflictVersionDiffs, setConflictVersionDiffs] =
        useState<ConflictVersionDiff>({});
    const [conflictCountDiffs, setConflictCountDiffs] =
        useState<ConflictCountDiff>({});
    const [conflictRemoteUpdatedAt, setConflictRemoteUpdatedAt] = useState<
        number | null
    >(null);
    const [conflictPreferredScopes, setConflictPreferredScopes] = useState<
        RemoteVersionKey[]
    >(() => parseConflictScopePreference());
    const [rememberConflictPolicy, setRememberConflictPolicy] =
        useState<boolean>(() => parseConflictPolicyRemember());
    const [syncClock, setSyncClock] = useState(() => Date.now());
    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true);
            setHasPendingSync(hasPendingSyncRecord());
            showToast(
                "온라인으로 전환됐어요. 미동기화 항목을 다시 저장할 수 있어요.",
            );
        };
        const onOffline = () => {
            setIsOnline(false);
            showToast(
                "오프라인 상태예요. 변경사항은 임시 저장 후 연결 복구 시 동기화돼요.",
            );
        };
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);
    useEffect(() => {
        localStorage.setItem(
            CONFLICT_SCOPE_PREF_KEY,
            JSON.stringify(conflictPreferredScopes),
        );
    }, [conflictPreferredScopes]);

    useEffect(() => {
        localStorage.setItem(
            CONFLICT_POLICY_REMEMBER_KEY,
            rememberConflictPolicy ? "1" : "0",
        );
    }, [rememberConflictPolicy]);
    useEffect(() => {
        if (!lastSyncSuccessAt) return;
        localStorage.setItem(
            LAST_SYNC_SUCCESS_AT_KEY,
            String(lastSyncSuccessAt),
        );
    }, [lastSyncSuccessAt]);

    useEffect(() => {
        const timer = setInterval(() => setSyncClock(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);
    const persist = useCallback(
        (
            task: () => Promise<void>,
            failMsg: string,
            scope: RemoteVersionKey,
        ) => {
            persistInFlightRef.current += 1;
            void Promise.resolve().then(task)
                .then(() => {
                    setHasPendingSync(false);
                    setLastSyncSuccessAt(Date.now());
                })
                .catch((e) => {
                    console.error("[persist]", failMsg, e);
                    const message = isStorageConflictError(e)
                        ? "다른 기기에서 데이터가 변경되어 저장 충돌이 발생했어요. 동기화 후 다시 시도해주세요."
                        : failMsg;
                    if (isStorageConflictError(e)) {
                        const keys = Array.from(new Set(e.conflictKeys));
                        setConflictKeys(keys);
                        setSelectedConflictKeys(
                            getDefaultSelectedConflictKeys(
                                keys,
                                conflictPreferredScopes,
                            ),
                        );
                        const nextDiffs: ConflictVersionDiff = {};
                        for (const key of keys) {
                            nextDiffs[key] = {
                                expected: e.expectedVersions[key],
                                remote: e.remoteVersions[key],
                            };
                        }
                        setConflictVersionDiffs(nextDiffs);
                        setConflictCountDiffs(e.countDiffs);
                        setConflictRemoteUpdatedAt(e.remoteUpdatedAt);
                        setShowSyncConflictModal(true);
                    }
                    showToast(message);
                    setHasPendingSync(true);
                    setFailedPersistTasks((prev) => {
                        const idx = prev.findIndex(
                            (item) =>
                                item.message === message &&
                                item.scope === scope,
                        );
                        if (idx >= 0) {
                            const copy = [...prev];
                            const current = copy[idx];
                            copy[idx] = {
                                ...current,
                                run: task,
                                scope,
                                attempts: current.attempts + 1,
                                lastFailedAt: Date.now(),
                            };
                            return copy;
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
                        ];
                    });
                }).finally(() => { persistInFlightRef.current -= 1; });
        },
        [conflictPreferredScopes],
    );

    const retryFailedPersistTasks = useCallback(
        (
            allowedScopes?: RemoteVersionKey[],
            mode: RetryRunMode = "all",
            afterSuccess?: () => Promise<void>,
        ) => {
            if (isRetryingPersist) return;
            const allow =
                allowedScopes && allowedScopes.length > 0
                    ? new Set<RemoteVersionKey>(allowedScopes)
                    : null;
            const queued = allow
                ? failedPersistTasks.filter((item) => allow.has(item.scope))
                : [...failedPersistTasks];
            if (queued.length === 0) {
                showToast("재시도할 저장 실패 항목이 없어요.");
                return;
            }
            const untouched = allow
                ? failedPersistTasks.filter((item) => !allow.has(item.scope))
                : [];
            setFailedPersistTasks(untouched);
            if (!allow) setLastRetryReasons({});
            setIsRetryingPersist(true);
            setRetryProgress({done: 0, total: queued.length});

            void (async () => {
                try {
                    const stillFailed: FailedPersistTask[] = [];
                    let succeededCount = 0;
                    const succeededScopes = new Set<RemoteVersionKey>();
                    const failedScopes = new Set<RemoteVersionKey>();
                    const failedReasons = new Map<
                        RemoteVersionKey,
                        Set<"conflict" | "save-failed">
                    >();
                    for (let i = 0; i < queued.length; i++) {
                        const item = queued[i];
                        try {
                            await item.run();
                            succeededCount += 1;
                            succeededScopes.add(item.scope);
                        } catch (e) {
                            console.error("[persist-retry]", item.message, e);
                            const reason: "conflict" | "save-failed" =
                                isStorageConflictError(e)
                                    ? "conflict"
                                    : "save-failed";
                            if (isStorageConflictError(e)) {
                                const keys = Array.from(
                                    new Set(e.conflictKeys),
                                );
                                setConflictKeys(keys);
                                setSelectedConflictKeys(
                                    getDefaultSelectedConflictKeys(
                                        keys,
                                        conflictPreferredScopes,
                                    ),
                                );
                                const nextDiffs: ConflictVersionDiff = {};
                                for (const key of keys) {
                                    nextDiffs[key] = {
                                        expected: e.expectedVersions[key],
                                        remote: e.remoteVersions[key],
                                    };
                                }
                                setConflictVersionDiffs(nextDiffs);
                                setConflictCountDiffs(e.countDiffs);
                                setConflictRemoteUpdatedAt(e.remoteUpdatedAt);
                                setShowSyncConflictModal(true);
                            }
                            failedScopes.add(item.scope);
                            const reasons =
                                failedReasons.get(item.scope) ??
                                new Set<"conflict" | "save-failed">();
                            reasons.add(reason);
                            failedReasons.set(item.scope, reasons);
                            stillFailed.push({
                                ...item,
                                attempts: item.attempts + 1,
                                lastFailedAt: Date.now(),
                            });
                        } finally {
                            setRetryProgress({
                                done: i + 1,
                                total: queued.length,
                            });
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
                                acc.set(
                                    item.scope,
                                    (acc.get(item.scope) ?? 0) + 1,
                                );
                                return acc;
                            }, new Map<RemoteVersionKey, number>()),
                        ).map(([scope, count]) => ({scope, count})),
                    });

                    setFailedPersistTasks((prev) => {
                        const merged = [...prev];
                        for (const failed of stillFailed) {
                            const idx = merged.findIndex(
                                (item) => item.id === failed.id,
                            );
                            if (idx >= 0) {
                                merged[idx] = failed;
                            } else {
                                merged.push(failed);
                            }
                        }
                        return merged;
                    });

                    const nextReasonState: Partial<
                        Record<RemoteVersionKey, RetryReasonCode[]>
                    > = {};
                    for (const [scope, reasons] of failedReasons.entries()) {
                        nextReasonState[scope] = Array.from(reasons);
                    }
                    setLastRetryReasons(nextReasonState);

                    if (succeededCount > 0 && afterSuccess) {
                        await afterSuccess().catch(() => {
                            showToast("저장한 데이터를 다시 불러오지 못했어요.");
                        });
                    }

                    if (stillFailed.length === 0) {
                        setHasPendingSync(false);
                        setLastSyncSuccessAt(Date.now());
                        const successLabels =
                            Array.from(succeededScopes).map(scopeLabel);
                        const summary =
                            successLabels.length > 0
                                ? ` (${successLabels.join(", ")})`
                                : "";
                        showToast(`미동기화 변경사항을 저장했어요.${summary}`);
                        setLastRetryReasons({});
                        return;
                    }

                    setHasPendingSync(true);
                    const failedLabels =
                        Array.from(failedScopes).map(scopeLabel);
                    const failedSummary =
                        failedLabels.length > 0
                            ? ` (${failedLabels.join(", ")})`
                            : "";
                    let conflictCount = 0;
                    let saveFailedCount = 0;
                    for (const reasons of failedReasons.values()) {
                        if (reasons.has("conflict")) conflictCount += 1;
                        if (reasons.has("save-failed")) saveFailedCount += 1;
                    }
                    const reasonParts: string[] = [];
                    if (conflictCount > 0)
                        reasonParts.push(`충돌 ${conflictCount}범위`);
                    if (saveFailedCount > 0)
                        reasonParts.push(`저장오류 ${saveFailedCount}범위`);
                    const reasonSuffix =
                        reasonParts.length > 0
                            ? ` (${reasonParts.join(" · ")})`
                            : "";
                    showToast(
                        `재시도 후 ${stillFailed.length}건이 남았어요.${failedSummary}${reasonSuffix}`,
                    );
                } finally {
                    setIsRetryingPersist(false);
                    setRetryProgress(null);
                }
            })();
        },
        [failedPersistTasks, conflictPreferredScopes, isRetryingPersist],
    );

    const getScopesByReasons = useCallback(
        (targets: RetryReasonCode[]): RemoteVersionKey[] => {
            const targetSet = new Set<RetryReasonCode>(targets);
            return Object.entries(lastRetryReasons)
                .filter(([, codes]) =>
                    (codes ?? []).some((code) => targetSet.has(code)),
                )
                .map(([scope]) => scope as RemoteVersionKey);
        },
        [lastRetryReasons],
    );

    const handleUseRemoteData = useCallback(() => {
        setShowSyncConflictModal(false);
        setConflictVersionDiffs({});
        setConflictCountDiffs({});
        setConflictRemoteUpdatedAt(null);
        setFailedPersistTasks([]);
        setLastRetryReasons({});
        setLastRetryResult(null);
        setHasPendingSync(false);
        // 미동기화 기록을 남기면 다음 로드 때 내 데이터가 다시 원격을 덮어쓰려 한다
        discardPendingSync();
        void hydrateData()
            .then(() => {
                setLastSyncSuccessAt(Date.now());
                showToast("원격 데이터로 동기화했어요.");
            })
            .catch(() => showToast("원격 데이터를 불러오지 못했어요."));
    }, [hydrateData]);

    const handleRetryMineAfterSync = useCallback(() => {
        if (rememberConflictPolicy) {
            setConflictPreferredScopes((prev) => {
                const next = new Set<RemoteVersionKey>(prev);
                const selected = new Set<RemoteVersionKey>(
                    selectedConflictKeys,
                );
                for (const key of conflictKeys) {
                    if (selected.has(key)) next.add(key);
                    else next.delete(key);
                }
                return Array.from(next);
            });
        }
        setShowSyncConflictModal(false);
        setConflictVersionDiffs({});
        setConflictCountDiffs({});
        setConflictRemoteUpdatedAt(null);
        // 재전송한 내 변경이 원격에 반영된 뒤 화면도 원격과 다시 맞춘다.
        // 맞추지 않으면 화면은 다른 기기 데이터로 남아, 다음 편집이 방금 지킨 변경을 덮어쓴다.
        void hydrateData()
            .then(() => {
                retryFailedPersistTasks(selectedConflictKeys, "all", hydrateData);
            })
            .catch(() => {
                showToast("동기화 후 재시도에 실패했어요.");
            });
    }, [
        hydrateData,
        retryFailedPersistTasks,
        selectedConflictKeys,
        conflictKeys,
        rememberConflictPolicy,
    ]);

    const toggleConflictKey = useCallback((key: RemoteVersionKey) => {
        setSelectedConflictKeys((prev) => {
            if (prev.includes(key)) {
                return prev.filter((item) => item !== key);
            }
            return [...prev, key];
        });
    }, []);

    const selectRecommendedConflictKeys = useCallback(() => {
        setSelectedConflictKeys(
            getDefaultSelectedConflictKeys(
                conflictKeys,
                conflictPreferredScopes,
            ),
        );
    }, [conflictKeys, conflictPreferredScopes]);

    const selectAllConflictKeys = useCallback(() => {
        setSelectedConflictKeys(conflictKeys);
    }, [conflictKeys]);

    const clearConflictKeySelection = useCallback(() => {
        setSelectedConflictKeys([]);
    }, []);

    return {
        isOnline,
        hasPendingSync,
        failedPersistTasks,
        lastRetryReasons,
        isRetryingPersist,
        retryProgress,
        lastRetryResult,
        lastSyncSuccessAt,
        setLastSyncSuccessAt,
        showSyncStatusDetails,
        setShowSyncStatusDetails,
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
        syncClock,
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
    };
}
