import { Database, X } from 'lucide-react'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export default function MergeLocalDataModal({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#3D8EF8]/15 border border-[#3D8EF8]/25 flex items-center justify-center shrink-0">
              <Database size={17} className="text-[#79B2FF]" />
            </span>
            <div>
              <h3 className="text-white text-base font-bold">데이터 병합 확인</h3>
              <p className="text-xs text-[#8B95A1] mt-1 leading-relaxed">
                로컬에 저장된 데이터를 Firebase 데이터와 병합할까요?
                병합 시 로컬 원본은 백업된 후 정리됩니다.
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-full bg-[#1E2236] text-[#8B95A1] flex items-center justify-center shrink-0" aria-label="닫기">
            <X size={14} />
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-[#1E2236] text-[#8B95A1] text-sm font-bold">
            병합 안 함
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-[#3D8EF8] text-white text-sm font-bold hover:bg-[#5AA0FF] transition-colors">
            병합하기
          </button>
        </div>
      </div>
    </div>
  )
}
