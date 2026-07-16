import { RefreshCw, X } from 'lucide-react'
import { useRef } from 'react'
import type { RecurringTransaction } from '../types'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../types'
import { useModalClose } from '../hooks/useModalClose'

type AutoApplyRecurringMode = 'ask' | 'always' | 'never'

interface Props {
  pending: RecurringTransaction[]
  mode: AutoApplyRecurringMode
  onModeChange: (mode: AutoApplyRecurringMode) => void
  onConfirm: () => void
  onDismiss: () => void
}

export default function AutoApplyRecurringModal({ pending, mode, onModeChange, onConfirm, onDismiss }: Props) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const { closing, handleClose, modalRef } = useModalClose(onDismiss, { initialFocusRef: confirmButtonRef })
  const total = pending.reduce((sum, r) => {
    return r.type === 'expense' ? sum - r.amount : sum + r.amount
  }, 0)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-apply-recurring-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div ref={modalRef} className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#3D8EF8]/15 border border-[#3D8EF8]/25 flex items-center justify-center shrink-0">
              <RefreshCw size={17} className="text-[#79B2FF]" />
            </span>
            <div>
              <h3 id="auto-apply-recurring-title" className="text-white text-base font-bold">정기 항목 자동 등록</h3>
              <p className="text-xs text-[#8B95A1] mt-1 leading-relaxed">
                오늘 날짜 기준 등록할 정기 항목이 {pending.length}건 있어요.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-[#1C1C1E] text-[#8B95A1] flex items-center justify-center shrink-0"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>

        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-2.5">
          {pending.map((r) => {
            const color = CATEGORY_COLOR[r.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
            return (
              <div key={r.id} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: color.bg }}
                >
                  {CATEGORY_EMOJI[r.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#F1F3F6] font-medium truncate block">{r.category}</span>
                  {r.description && (
                    <span className="text-xs text-[#4E5968] truncate block">{r.description}</span>
                  )}
                </div>
                <span className="text-xs text-[#4E5968] shrink-0">매월 {r.dayOfMonth}일</span>
                <span className={`text-sm font-bold num shrink-0 ${r.type === 'income' ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                  {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()}원
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[#4E5968]">총 {pending.length}건</span>
          <span className={`text-sm font-bold num ${total >= 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
            {total >= 0 ? '+' : ''}{total.toLocaleString()}원
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#8B95A1]">다음 달부터 반복거래 처리 방식</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onModeChange('ask')}
              aria-pressed={mode === 'ask'}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'ask' ? 'bg-[#3D8EF8] text-white' : 'bg-[#1C1C1E] text-[#8B95A1]'}`}
            >
              매달 확인
            </button>
            <button
              type="button"
              onClick={() => onModeChange('always')}
              aria-pressed={mode === 'always'}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'always' ? 'bg-[#2ACF6A] text-[#0D0F14]' : 'bg-[#1C1C1E] text-[#8B95A1]'}`}
            >
              자동 등록
            </button>
            <button
              type="button"
              onClick={() => onModeChange('never')}
              aria-pressed={mode === 'never'}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'never' ? 'bg-[#F25260] text-white' : 'bg-[#1C1C1E] text-[#8B95A1]'}`}
            >
              표시 안 함
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl bg-[#1C1C1E] text-[#8B95A1] text-sm font-bold"
          >
            나중에
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#3D8EF8] text-white text-sm font-bold hover:bg-[#5AA0FF] transition-colors"
          >
            지금 등록
          </button>
        </div>
      </div>
    </div>
  )
}
