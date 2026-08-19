import { AlertTriangle, RefreshCw, ShieldX } from 'lucide-react'

interface Props {
    conflictKeys: string[]
    selectedKeys: string[]
    recommendedKeys: string[]
    versionDiffs: Partial<Record<string, { expected: number; remote: number }>>
    countDiffs: Partial<Record<string, { localCount: number | null; remoteCount: number | null }>>
    remoteUpdatedAt: number | null
    rememberPolicy: boolean
    onToggleKey: (key: string) => void
    onSelectRecommended: () => void
    onSelectAll: () => void
    onClearSelection: () => void
    onToggleRememberPolicy: (checked: boolean) => void
    onUseRemote: () => void
    onRetryMine: () => void
    onClose: () => void
}

const KEY_LABELS: Record<string, string> = {
    transactions: '거래내역',
    memos: '메모',
    budgets: '예산',
    recurring: '반복거래',
    subscriptions: '구독',
    goals: '목표',
    settings: '설정',
}

function getLabel(key: string): string {
    return KEY_LABELS[key] ?? key
}

function revDeltaText(expected: number, remote: number): string {
    const delta = remote - expected
    if (delta > 0) return `+${delta}`
    return String(delta)
}

function formatUpdatedAt(ts: number | null): string {
    if (!ts) return '알 수 없음'
    try {
        return new Date(ts).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return '알 수 없음'
    }
}

function formatRelativeTime(ts: number | null): string {
    if (!ts) return '알 수 없음'
    const deltaMs = Date.now() - ts
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return '방금 전'
    const minutes = Math.floor(deltaMs / (1000 * 60))
    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}시간 전`
    const days = Math.floor(hours / 24)
    return `${days}일 전`
}

export default function SyncConflictModal({
    conflictKeys,
    selectedKeys,
    recommendedKeys,
    versionDiffs,
    countDiffs,
    remoteUpdatedAt,
    rememberPolicy,
    onToggleKey,
    onSelectRecommended,
    onSelectAll,
    onClearSelection,
    onToggleRememberPolicy,
    onUseRemote,
    onRetryMine,
    onClose,
}: Props) {
    const recommendedSet = new Set(recommendedKeys)

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#F25260]/15 border border-[#F25260]/25 flex items-center justify-center shrink-0">
                        <AlertTriangle size={17} className="text-[#FF8A95]" />
                    </span>
                    <div>
                        <h3 className="text-white text-base font-bold">동기화 충돌 발생</h3>
                        <p className="text-xs text-[#8B95A1] mt-1 leading-relaxed">
                            다른 기기에서 변경된 항목과 현재 저장 내용이 충돌했어요.
                        </p>
                    </div>
                </div>

                {conflictKeys.length > 0 && (
                    <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onSelectRecommended}
                                className="text-[10px] px-2 py-1 rounded-md bg-[#3D8EF8]/12 text-[#A9CCFF] border border-[#3D8EF8]/25"
                            >
                                권장 적용
                            </button>
                            <button
                                type="button"
                                onClick={onSelectAll}
                                className="text-[10px] px-2 py-1 rounded-md bg-[#2C2C2E] text-[#C8D1DC] border border-white/10"
                            >
                                모두 내 변경 유지
                            </button>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="text-[10px] px-2 py-1 rounded-md bg-[#2C2C2E] text-[#8B95A1] border border-white/10"
                            >
                                모두 원격 유지
                            </button>
                        </div>

                        <div className="text-[10px] text-[#6E7782] leading-relaxed">
                            권장 기준: 최근 충돌 이력과 선택 정책을 반영해 자동 제안됩니다.
                        </div>

                        <div className="space-y-2">
                            {conflictKeys.map((key) => {
                                const diff = versionDiffs[key]
                                const countDiff = countDiffs[key]
                                const isMine = selectedKeys.includes(key)
                                const isRecommended = recommendedSet.has(key)

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => onToggleKey(key)}
                                        className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${isMine
                                            ? 'bg-[#3D8EF8]/12 border-[#3D8EF8]/35'
                                            : 'bg-[#2C2C2E] border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`text-xs font-bold ${isMine ? 'text-[#A9CCFF]' : 'text-[#C8D1DC]'}`}>{getLabel(key)}</span>
                                                {isRecommended && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/20 text-[#A9CCFF]">권장</span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold ${isMine ? 'text-[#A9CCFF]' : 'text-[#8B95A1]'}`}>
                                                {isMine ? '내 변경 유지' : '원격 유지'}
                                            </span>
                                        </div>

                                        {(countDiff && countDiff.localCount !== null && countDiff.remoteCount !== null) && (
                                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#8B95A1]">
                                                <span>건수</span>
                                                <span className="num">내 {countDiff.localCount} / 원격 {countDiff.remoteCount}</span>
                                            </div>
                                        )}

                                        {diff && (
                                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#6E7782]">
                                                <span>버전 차이</span>
                                                <span className="num">내 {diff.expected} / 원격 {diff.remote} (Δ {revDeltaText(diff.expected, diff.remote)})</span>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                <p className="text-[11px] text-[#4E5968] leading-relaxed">
                    원격 데이터를 먼저 동기화한 뒤, 선택한 항목만 다시 저장할 수 있습니다.
                </p>

                <div className="bg-[#12151E] border border-white/6 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-[#6E7782] leading-relaxed">
                        현재 선택: {selectedKeys.length} / 전체 충돌: {conflictKeys.length}
                    </p>
                    <p className="text-[10px] text-[#6E7782] leading-relaxed mt-0.5">
                        원격 마지막 수정: {formatRelativeTime(remoteUpdatedAt)} ({formatUpdatedAt(remoteUpdatedAt)})
                    </p>
                </div>

                {conflictKeys.includes('settings') && conflictKeys.length > 1 && (
                    <p className="text-[10px] text-[#8B95A1] leading-relaxed">
                        권장: 설정은 로컬 값이 유효하면 로컬 우선으로 병합됩니다.
                    </p>
                )}

                <label className="flex items-center gap-2 text-[11px] text-[#8B95A1]">
                    <input
                        type="checkbox"
                        checked={rememberPolicy}
                        onChange={(e) => onToggleRememberPolicy(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-[#1C1C1E]"
                    />
                    이 선택을 다음 충돌에도 기본 적용
                </label>

                <div className="space-y-2">
                    <button
                        onClick={onUseRemote}
                        className="w-full py-2.5 rounded-xl bg-[#1C1C1E] text-[#C8D1DC] text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <ShieldX size={14} />
                        원격 데이터로 동기화
                    </button>
                    <button
                        onClick={onRetryMine}
                        disabled={selectedKeys.length === 0}
                        className="w-full py-2.5 rounded-xl bg-[#3D8EF8] disabled:opacity-40 text-white text-sm font-bold hover:bg-[#5AA0FF] transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={14} />
                        선택 항목 다시 저장
                    </button>
                </div>
            </div>
        </div>
    )
}
