import { X } from 'lucide-react'

interface Props {
  row: Record<string, string>
  headers: string[]
  onClose: () => void
}

export default function MappingRowDetailModal({ row, headers, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end justify-center z-100"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] border-t border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="px-6 pt-3 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white text-[16px] font-bold">원본 행 상세</p>
              <p className="text-[11px] text-[#4E5968] mt-0.5">선택한 행의 전체 컬럼 값을 확인할 수 있어요</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
              <X size={15} className="text-[#8B95A1]" />
            </button>
          </div>

          <div className="max-h-[58vh] overflow-y-auto space-y-2 pr-0.5">
            {headers.map((h) => (
              <div key={h} className="rounded-xl border border-white/6 bg-[#2C2C2E]/70 px-4 py-3">
                <p className="text-[10px] font-semibold tracking-wide text-[#4E5968] uppercase">{h}</p>
                <p className="text-sm text-white break-all mt-1">{row[h] || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
