import { useRef } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { RecurringTransaction } from '../types'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../types'
import { useModalClose } from '../hooks/useModalClose'
import { formatRecurringSchedule } from '../lib/recurringSchedule'

interface Props {
  applied: RecurringTransaction[]
  onClose: () => void
}

export default function AutoApplyResultModal({ applied, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const { closing, handleClose, modalRef } = useModalClose(onClose, { initialFocusRef: closeButtonRef })

  const total = applied.reduce((sum, item) => {
    return item.type === 'income' ? sum + item.amount : sum - item.amount
  }, 0)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-apply-result-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div ref={modalRef} className="w-full sm:max-w-sm bg-[#0D0F14] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#2ACF6A]/15 border border-[#2ACF6A]/25 flex items-center justify-center shrink-0">
              <CheckCircle2 size={17} className="text-[#2ACF6A]" />
            </span>
            <div>
              <h3 id="auto-apply-result-title" className="text-white text-base font-bold">정기 항목 등록 완료</h3>
              <p className="text-xs text-[#8B95A1] mt-1 leading-relaxed">
                총 {applied.length}건을 등록했어요. 적용된 항목을 확인하세요.
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

        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3 space-y-2.5 max-h-72 overflow-y-auto">
          {applied.map((item) => {
            const color = CATEGORY_COLOR[item.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
            return (
              <div key={item.id} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: color.bg }}
                >
                  {CATEGORY_EMOJI[item.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#F1F3F6] font-medium truncate block">{item.category}</span>
                  {item.description && (
                    <span className="text-xs text-[#4E5968] truncate block">{item.description}</span>
                  )}
                </div>
                <span className="text-xs text-[#4E5968] shrink-0">{formatRecurringSchedule(item)}</span>
                <span className={`text-sm font-bold num shrink-0 ${item.type === 'income' ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                  {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()}원
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[#4E5968]">총 {applied.length}건</span>
          <span className={`text-sm font-bold num ${total >= 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
            {total >= 0 ? '+' : ''}{total.toLocaleString()}원
          </span>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          className="w-full py-2.5 rounded-xl bg-[#3D8EF8] text-white text-sm font-bold hover:bg-[#5AA0FF] transition-colors"
        >
          확인
        </button>
      </div>
    </div>
  )
}
