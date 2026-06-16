import { AlertTriangle, RefreshCw, ShieldX } from 'lucide-react'

interface Props {
    conflictKeys: string[]
    selectedKeys: string[]
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
    stockTrades: '주식거래',
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

export default function SyncConflictModal({
    conflictKeys,
    selectedKeys,
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
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onSelectRecommended}
                                className="text-[10px] px-2 py-1 rounded-md bg-[#3D8EF8]/12 text-[#A9CCFF] border border-[#3D8EF8]/25"
                            >
                                권장 선택
                            </button>
                            <button
                                type="button"
                                onClick={onSelectAll}
                                className="text-[10px] px-2 py-1 rounded-md bg-[#2C2C2E] text-[#C8D1DC] border border-white/10"
                            >
                                전체 선택
                            </button>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="text-[10px] px-2 py-1 rounded-md bg-[#2C2C2E] text-[#8B95A1] border border-white/10"
                            >
                                선택 해제
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {conflictKeys.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => onToggleKey(key)}
                                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${selectedKeys.includes(key)
                                        ? 'bg-[#3D8EF8]/20 text-[#A9CCFF] border border-[#3D8EF8]/35'
                                        : 'bg-[#2C2C2E] text-[#8B95A1] border border-white/5'
                                        }`}
                                >
                                    {getLabel(key)}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-1">
                            {conflictKeys.map((key) => {
                                const diff = versionDiffs[key]
                                const countDiff = countDiffs[key]
                                if (!diff && !countDiff) return null
                                return (
                                    <div key={`${key}_rev`} className="text-[10px] text-[#8B95A1] space-y-0.5">
                                        {diff && (
                                            <div className="flex items-center justify-between">
                                                <span>{getLabel(key)}</span>
                                                <span className="num">내 기준 rev {diff.expected} / 원격 rev {diff.remote} (Δ {revDeltaText(diff.expected, diff.remote)})</span>
                                            </div>
                                        )}
                                        {countDiff && countDiff.localCount !== null && countDiff.remoteCount !== null && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[#6E7782]">건수</span>
                                                <span className="num text-[#6E7782]">내 {countDiff.localCount} / 원격 {countDiff.remoteCount}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                <p className="text-[11px] text-[#4E5968] leading-relaxed">
                    원격 데이터를 먼저 동기화한 뒤, 선택한 항목만 다시 저장할 수 있습니다.
                </p>

                <p className="text-[10px] text-[#6E7782] leading-relaxed">
                    현재 선택: {selectedKeys.length} / 전체 충돌: {conflictKeys.length}
                </p>

                <p className="text-[10px] text-[#6E7782] leading-relaxed">
                    원격 마지막 수정: {formatUpdatedAt(remoteUpdatedAt)}
                </p>

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
