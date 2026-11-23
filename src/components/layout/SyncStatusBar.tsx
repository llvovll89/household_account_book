import { useEffect, useMemo } from "react";
import { CloudOff, RefreshCw, WifiOff } from "lucide-react";
import type { RemoteVersionKey } from "../../lib/storage";
import { showToast } from "../../lib/toast";
import { scopeLabel, type RetryReasonCode, type useSyncPersistence } from "../../hooks/useSyncPersistence";

function getRetryReasonTotals(
    reasonsByScope: Partial<Record<RemoteVersionKey, RetryReasonCode[]>>,
) {
    let conflict = 0;
    let saveFailed = 0;
    for (const reasons of Object.values(reasonsByScope)) {
        if ((reasons ?? []).includes("conflict")) conflict += 1;
        if ((reasons ?? []).includes("save-failed")) saveFailed += 1;
    }
    return {conflict, saveFailed};
}

function formatRelativeSyncTime(ts: number | null, now: number): string {
    if (!ts) return "기록 없음";
    const deltaMs = now - ts;
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return "방금 저장";
    const minutes = Math.floor(deltaMs / (1000 * 60));
    if (minutes < 1) return "방금 저장";
    if (minutes < 60) return `${minutes}분 전 저장`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전 저장`;
    const days = Math.floor(hours / 24);
    return `${days}일 전 저장`;
}

function formatAbsoluteSyncTime(ts: number | null): string {
    if (!ts) return "기록 없음";
    try {
        return new Date(ts).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return "기록 없음";
    }
}

interface Props {
    sync: ReturnType<typeof useSyncPersistence>;
}

/** 헤더 아래 동기화 상태 바(오프라인·저장 대기·재시도·실패 상세). App.tsx에서 옮겨 왔다 */
export function SyncStatusBar({ sync }: Props) {
    const {
        isOnline,
        hasPendingSync,
        failedPersistTasks,
        lastRetryReasons,
        isRetryingPersist,
        retryProgress,
        lastSyncSuccessAt,
        syncClock,
        conflictKeys,
        getScopesByReasons,
        retryFailedPersistTasks,
        showSyncStatusDetails,
        setShowSyncStatusDetails,
        setShowSyncConflictModal,
        setShowSyncRecoveryGuideModal,
    } = sync;
    const retryReasonTotals = useMemo(
        () => getRetryReasonTotals(lastRetryReasons),
        [lastRetryReasons],
    );
    const pendingCount = failedPersistTasks.length;
    const failedScopeDetails = useMemo(() => {
        const map = new Map<
            RemoteVersionKey,
            {count: number; maxAttempts: number; reasons: RetryReasonCode[]}
        >();
        failedPersistTasks.forEach((task) => {
            const prev = map.get(task.scope);
            if (!prev) {
                map.set(task.scope, {
                    count: 1,
                    maxAttempts: task.attempts,
                    reasons: lastRetryReasons[task.scope] ?? [],
                });
                return;
            }
            map.set(task.scope, {
                count: prev.count + 1,
                maxAttempts: Math.max(prev.maxAttempts, task.attempts),
                reasons: lastRetryReasons[task.scope] ?? prev.reasons,
            });
        });
        return Array.from(map.entries())
            .map(([scope, detail]) => ({scope, ...detail}))
            .sort((a, b) => b.count - a.count);
    }, [failedPersistTasks, lastRetryReasons]);
    const conflictRetryScopes = useMemo(
        () => getScopesByReasons(["conflict"]),
        [getScopesByReasons],
    );
    const saveFailedRetryScopes = useMemo(
        () => getScopesByReasons(["save-failed"]),
        [getScopesByReasons],
    );
    const retryRatio =
        retryProgress && retryProgress.total > 0
            ? Math.min(
                  100,
                  Math.round((retryProgress.done / retryProgress.total) * 100),
              )
            : 0;
    const showSyncStatusBar =
        !isOnline || hasPendingSync || pendingCount > 0 || isRetryingPersist;
    const syncStatusBarMeta = useMemo(() => {
        if (isRetryingPersist && retryProgress) {
            return {
                title: `동기화 재시도 중 ${retryProgress.done}/${retryProgress.total}`,
                detail:
                    pendingCount > 0
                        ? `남은 실패 ${pendingCount}건`
                        : "실패 항목 복구 중",
                toneClass: "bg-raised border-tone-blue/30",
                iconClass: "text-accent",
            };
        }

        if (!isOnline) {
            return {
                title: hasPendingSync
                    ? `오프라인 · 저장 대기 ${pendingCount}건`
                    : "오프라인 상태",
                detail: hasPendingSync
                    ? "연결 복구 시 자동 재시도할 수 있어요"
                    : "변경사항은 로컬에 임시 저장됩니다",
                toneClass: "bg-tone-red/10 border-tone-red/25",
                iconClass: "text-tone-red-soft",
            };
        }

        if (pendingCount > 0) {
            return {
                title: `저장 실패 ${pendingCount}건`,
                detail:
                    Object.keys(lastRetryReasons).length > 0
                        ? `최근 원인: 충돌 ${retryReasonTotals.conflict}범위 · 저장오류 ${retryReasonTotals.saveFailed}범위`
                        : "네트워크 복구 후 다시 저장해주세요",
                toneClass: "bg-tone-red/10 border-tone-red/25",
                iconClass: "text-tone-red-soft",
            };
        }

        return {
            title: "동기화 대기 중",
            detail: "저장 대기 항목이 있습니다",
            toneClass: "bg-raised border-tone-blue/25",
            iconClass: "text-accent",
        };
    }, [
        hasPendingSync,
        isOnline,
        isRetryingPersist,
        lastRetryReasons,
        pendingCount,
        retryProgress,
        retryReasonTotals.conflict,
        retryReasonTotals.saveFailed,
    ]);

    useEffect(() => {
        if (pendingCount > 0) return;
        setShowSyncStatusDetails(false);
    }, [pendingCount, setShowSyncStatusDetails]);

    if (!showSyncStatusBar) return null;
    return (
    <div
        className={`mt-3 rounded-2xl border px-3 py-2.5 flex items-center gap-3 ${syncStatusBarMeta.toneClass}`}
    >
        {!isOnline ? (
            <WifiOff
                size={14}
                className={`${syncStatusBarMeta.iconClass} shrink-0`}
            />
        ) : isRetryingPersist ? (
            <RefreshCw
                size={14}
                className={`${syncStatusBarMeta.iconClass} shrink-0 animate-spin`}
            />
        ) : (
            <CloudOff
                size={14}
                className={`${syncStatusBarMeta.iconClass} shrink-0`}
            />
        )}
        <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-fg">
                {syncStatusBarMeta.title}
            </p>
            <p className="text-[10px] text-muted truncate">
                {syncStatusBarMeta.detail}
            </p>
            {lastSyncSuccessAt && (
                <p
                    title={`최근 저장 시각: ${formatAbsoluteSyncTime(lastSyncSuccessAt)}`}
                    className="text-[10px] text-muted mt-0.5 truncate"
                >
                    마지막 저장:{" "}
                    {formatRelativeSyncTime(
                        lastSyncSuccessAt,
                        syncClock,
                    )}
                </p>
            )}
            {isRetryingPersist && retryProgress && (
                <div className="mt-1.5 h-1.5 rounded-full bg-raised overflow-hidden">
                    <div
                        className="h-full bg-action text-on-action transition-all"
                        style={{width: `${retryRatio}%`}}
                    />
                </div>
            )}
            {showSyncStatusDetails &&
                failedScopeDetails.length > 0 && (
                    <div className="mt-1.5 grid grid-cols-1 gap-1">
                        {failedScopeDetails
                            .slice(0, 4)
                            .map((item) => (
                                <div
                                    key={item.scope}
                                    className="flex items-center justify-between px-2 py-1 rounded-lg bg-raised border border-white/5"
                                >
                                    <div className="min-w-0">
                                        <span className="text-[10px] text-fg font-semibold">
                                            {scopeLabel(
                                                item.scope,
                                            )}
                                        </span>
                                        {item.reasons
                                            .length > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                {item.reasons.includes(
                                                    "conflict",
                                                ) && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-tone-red/15 text-tone-red-pale">
                                                        충돌
                                                    </span>
                                                )}
                                                {item.reasons.includes(
                                                    "save-failed",
                                                ) && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-tone-blue/15 text-tone-blue-pale">
                                                        저장오류
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted num">
                                        {item.count}건 ·
                                        재시도{" "}
                                        {item.maxAttempts}회
                                    </span>
                                </div>
                            ))}
                    </div>
                )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
                {pendingCount > 0 && (
                    <button
                        onClick={() =>
                            setShowSyncStatusDetails(
                                (v) => !v,
                            )
                        }
                        className="px-2 py-1.5 rounded-lg bg-raised text-fg text-[11px] font-bold border border-white/10"
                    >
                        {showSyncStatusDetails
                            ? "상세 닫기"
                            : "상세"}
                    </button>
                )}
                {conflictRetryScopes.length > 0 && (
                    <button
                        onClick={() => {
                            if (conflictKeys.length > 0) {
                                setShowSyncConflictModal(
                                    true,
                                );
                                return;
                            }
                            showToast(
                                "현재 충돌 항목이 없어요.",
                            );
                        }}
                        className="px-2 py-1.5 rounded-lg bg-raised text-tone-red-pale text-[11px] font-bold border border-tone-red/30"
                    >
                        충돌 해결
                    </button>
                )}
                {Object.keys(lastRetryReasons).length >
                    0 && (
                    <button
                        onClick={() =>
                            setShowSyncRecoveryGuideModal(
                                true,
                            )
                        }
                        className="px-2 py-1.5 rounded-lg bg-raised text-fg text-[11px] font-bold border border-white/10"
                    >
                        가이드
                    </button>
                )}
                <button
                    onClick={() =>
                        retryFailedPersistTasks(
                            undefined,
                            "all",
                        )
                    }
                    disabled={
                        isRetryingPersist ||
                        pendingCount === 0
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-tone-red disabled:opacity-40 text-white text-[11px] font-bold hover:bg-tone-red-soft transition-colors"
                >
                    {isRetryingPersist
                        ? "재시도 중..."
                        : "전체 재시도"}
                </button>
            </div>
            {Object.keys(lastRetryReasons).length > 0 && (
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => {
                            if (
                                conflictRetryScopes.length ===
                                0
                            ) {
                                showToast(
                                    "충돌 항목이 없어요.",
                                );
                                return;
                            }
                            retryFailedPersistTasks(
                                conflictRetryScopes,
                                "conflict-only",
                            );
                        }}
                        disabled={
                            isRetryingPersist ||
                            conflictRetryScopes.length === 0
                        }
                        className="px-2 py-1 rounded-lg bg-raised text-tone-red-pale text-[10px] font-bold border border-tone-red/30 disabled:opacity-40"
                    >
                        충돌만
                    </button>
                    <button
                        onClick={() => {
                            if (
                                saveFailedRetryScopes.length ===
                                0
                            ) {
                                showToast(
                                    "저장오류 항목이 없어요.",
                                );
                                return;
                            }
                            retryFailedPersistTasks(
                                saveFailedRetryScopes,
                                "save-failed-only",
                            );
                        }}
                        disabled={
                            isRetryingPersist ||
                            saveFailedRetryScopes.length ===
                                0
                        }
                        className="px-2 py-1 rounded-lg bg-raised text-tone-blue-pale text-[10px] font-bold border border-tone-blue/30 disabled:opacity-40"
                    >
                        저장오류만
                    </button>
                </div>
            )}
        </div>
    </div>
    );
}
