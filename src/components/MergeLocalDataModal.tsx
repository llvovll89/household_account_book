import { Database, X } from 'lucide-react'
import type { LocalDataCounts } from '../lib/storage'

interface Props {
  onConfirm: () => void
  onCancel: () => void
  counts: LocalDataCounts
}

const COUNT_LABELS: { key: keyof LocalDataCounts; label: string }[] = [
  { key: 'transactions', label: '거래내역' },
  { key: 'memos', label: '메모' },
  { key: 'budgets', label: '예산' },
  { key: 'recurring', label: '반복거래' },
  { key: 'stockTrades', label: '주식거래' },
]

export default function MergeLocalDataModal({ onConfirm, onCancel, counts }: Props) {
  const items = COUNT_LABELS.filter(({ key }) => counts[key] > 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#3D8EF8]/15 border border-[#3D8EF8]/25 flex items-center justify-center shrink-0">
              <Database size={17} className="text-[#79B2FF]" />
            </span>
            <div>
              <h3 className="text-white text-base font-bold">로컬 데이터 발견</h3>
              <p className="text-xs text-[#8B95A1] mt-1 leading-relaxed">
                로그인 전 저장된 데이터를 Firebase 계정과 병합할까요?
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-full bg-[#1C1C1E] text-[#8B95A1] flex items-center justify-center shrink-0" aria-label="닫기">
            <X size={14} />
          </button>
        </div>

        {items.length > 0 && (
          <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map(({ key, label }) => (
              <span key={key} className="text-xs text-[#8B95A1]">
                {label} <span className="text-white font-bold num">{counts[key]}</span>건
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-[#4E5968] leading-relaxed">
          병합하지 않으면 로컬 데이터는 삭제되며 복구할 수 없습니다.
        </p>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-[#1C1C1E] text-[#8B95A1] text-sm font-bold">
            삭제 후 계속
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-[#3D8EF8] text-white text-sm font-bold hover:bg-[#5AA0FF] transition-colors">
            병합하기
          </button>
        </div>
      </div>
    </div>
  )
}
