import { AlertCircle, RefreshCw, ShieldAlert, X } from 'lucide-react'

interface Props {
    reasons: Array<'conflict' | 'save-failed'>
    isRetrying?: boolean
    retryProgress?: {
        done: number
        total: number
    } | null
    retryResult?: {
        attempted: number
        succeeded: number
        failed: number
        mode: 'all' | 'conflict-only' | 'save-failed-only'
        finishedAt: number
        failedScopeSummary?: string
    } | null
    onOpenConflict?: () => void
    onRetryNow?: () => void
    onRetryConflictOnly?: () => void
    onRetrySaveFailedOnly?: () => void
    onClose: () => void
}

function hasReason(reasons: Array<'conflict' | 'save-failed'>, reason: 'conflict' | 'save-failed'): boolean {
    return reasons.includes(reason)
}

function formatTime(ts: number): string {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
}

export default function SyncRecoveryGuideModal({
    reasons,
    isRetrying = false,
    retryProgress = null,
    retryResult = null,
    onOpenConflict,
    onRetryNow,
    onRetryConflictOnly,
    onRetrySaveFailedOnly,
    onClose,
}: Props) {
    const showConflict = hasReason(reasons, 'conflict')
    const showSaveFailed = hasReason(reasons, 'save-failed')
    const progressRatio = retryProgress && retryProgress.total > 0
        ? Math.min(100, Math.round((retryProgress.done / retryProgress.total) * 100))
        : 0

    const retryModeLabel = retryResult
        ? retryResult.mode === 'conflict-only'
            ? '충돌만 재시도'
            : retryResult.mode === 'save-failed-only'
                ? '저장오류만 재시도'
                : '전체 재시도'
        : ''

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-[#F5BE3A]/15 border border-[#F5BE3A]/25 flex items-center justify-center shrink-0">
                            <AlertCircle size={17} className="text-[#FFD66A]" />
                        </span>
                        <div>
                            <h3 className="text-white text-base font-bold">동기화 해결 가이드</h3>
                            <p className="text-xs text-[#8B95A1] mt-1 leading-relaxed">
                                현재 실패 원인 기준으로 복구 순서를 안내합니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-[#1C1C1E] text-[#8B95A1] flex items-center justify-center shrink-0"
                        aria-label="닫기"
                    >
                        <X size={14} />
                    </button>
                </div>

                {showConflict && (
                    <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={13} className="text-[#FF8A95]" />
                            <p className="text-xs font-bold text-[#FFD5D9]">충돌 대응</p>
                        </div>
                        <p className="text-[11px] text-[#8B95A1]">1. 원격 데이터로 동기화 실행</p>
                        <p className="text-[11px] text-[#8B95A1]">2. 필요한 항목만 선택 후 다시 저장</p>
                        <p className="text-[11px] text-[#8B95A1]">3. 자주 충돌하는 항목은 정책 기억 토글 사용</p>
                    </div>
                )}

                {showSaveFailed && (
                    <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <RefreshCw size={13} className="text-[#79B2FF]" />
                            <p className="text-xs font-bold text-[#CFE2FF]">저장 오류 대응</p>
                        </div>
                        <p className="text-[11px] text-[#8B95A1]">1. 네트워크 연결 상태 확인</p>
                        <p className="text-[11px] text-[#8B95A1]">2. 실패 배너에서 전체 재시도 실행</p>
                        <p className="text-[11px] text-[#8B95A1]">3. 반복되면 잠시 후 재시도</p>
                    </div>
                )}

                {!showConflict && !showSaveFailed && (
                    <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3">
                        <p className="text-[11px] text-[#8B95A1]">원인을 식별하는 중입니다. 잠시 후 다시 시도하세요.</p>
                    </div>
                )}

                {isRetrying && retryProgress && (
                    <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-[#CFE2FF]">재시도 진행 중</p>
                            <p className="text-[11px] text-[#8B95A1] num">{retryProgress.done}/{retryProgress.total}</p>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#2C2C2E] overflow-hidden">
                            <div
                                className="h-full bg-[#3D8EF8] transition-all"
                                style={{ width: `${progressRatio}%` }}
                            />
                        </div>
                    </div>
                )}

                {!isRetrying && retryResult && (
                    <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-1">
                        <p className="text-[11px] font-bold text-[#C8D1DC]">최근 실행 결과 · {retryModeLabel}</p>
                        <p className="text-[10px] text-[#8B95A1]">실행 시각 {formatTime(retryResult.finishedAt)}</p>
                        <p className="text-[11px] text-[#8B95A1] num">
                            시도 {retryResult.attempted}건 / 성공 {retryResult.succeeded}건 / 실패 {retryResult.failed}건
                        </p>
                        {retryResult.failed > 0 && retryResult.failedScopeSummary && (
                            <p className="text-[10px] text-[#F0B7BE]">실패 분포: {retryResult.failedScopeSummary}</p>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {showConflict && onOpenConflict && (
                        <button
                            onClick={onOpenConflict}
                            disabled={isRetrying}
                            className="flex-1 py-2.5 rounded-xl bg-[#1C1C1E] text-[#C8D1DC] text-sm font-bold border border-white/10"
                        >
                            충돌 해결 열기
                        </button>
                    )}
                    {onRetryNow && (
                        <button
                            onClick={onRetryNow}
                            disabled={isRetrying}
                            className="flex-1 py-2.5 rounded-xl bg-[#3D8EF8] disabled:opacity-40 text-white text-sm font-bold hover:bg-[#5AA0FF] transition-colors"
                        >
                            {isRetrying ? '재시도 중...' : '지금 재시도'}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {showConflict && onRetryConflictOnly && (
                        <button
                            onClick={onRetryConflictOnly}
                            disabled={isRetrying}
                            className="flex-1 py-2.5 rounded-xl bg-[#2C2C2E] disabled:opacity-40 text-[#FFD5D9] text-sm font-bold border border-[#F25260]/25"
                        >
                            충돌만 재시도
                        </button>
                    )}
                    {showSaveFailed && onRetrySaveFailedOnly && (
                        <button
                            onClick={onRetrySaveFailedOnly}
                            disabled={isRetrying}
                            className="flex-1 py-2.5 rounded-xl bg-[#2C2C2E] disabled:opacity-40 text-[#CFE2FF] text-sm font-bold border border-[#3D8EF8]/25"
                        >
                            저장오류만 재시도
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
