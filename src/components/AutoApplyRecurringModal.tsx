import { RefreshCw, X } from 'lucide-react'
import { useRef } from 'react'
import type { RecurringTransaction } from '../types'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../types'
import { useModalClose } from '../hooks/useModalClose'
import { formatRecurringSchedule } from '../lib/recurringSchedule'

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
      <div ref={modalRef} className="w-full sm:max-w-sm bg-raised border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-tone-blue/15 border border-tone-blue/25 flex items-center justify-center shrink-0">
              <RefreshCw size={17} className="text-accent" />
            </span>
            <div>
              <h3 id="auto-apply-recurring-title" className="text-white text-base font-bold">정기 항목 자동 등록</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                오늘 날짜 기준 등록할 정기 항목이 {pending.length}건 있어요.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-surface text-muted flex items-center justify-center shrink-0"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>

        <div className="bg-surface rounded-2xl px-4 py-3 space-y-2.5">
          {pending.map((r) => {
            const color = CATEGORY_COLOR[r.category] ?? { bg: 'rgba(139,149,161,0.12)', text: 'var(--muted)' }
            return (
              <div key={r.id} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: color.bg }}
                >
                  {CATEGORY_EMOJI[r.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-fg font-medium truncate block">{r.category}</span>
                  {r.description && (
                    <span className="text-xs text-muted truncate block">{r.description}</span>
                  )}
                </div>
                <span className="text-xs text-muted shrink-0">{formatRecurringSchedule(r)}</span>
                <span className={`text-sm font-bold num shrink-0 ${r.type === 'income' ? 'text-income' : 'text-expense'}`}>
                  {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()}원
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted">총 {pending.length}건</span>
          <span className={`text-sm font-bold num ${total >= 0 ? 'text-income' : 'text-expense'}`}>
            {total >= 0 ? '+' : ''}{total.toLocaleString()}원
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted">다음 달부터 반복거래 처리 방식</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onModeChange('ask')}
              aria-pressed={mode === 'ask'}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'ask' ? 'bg-action text-on-action ' : 'bg-surface text-muted'}`}
            >
              매달 확인
            </button>
            <button
              type="button"
              onClick={() => onModeChange('always')}
              aria-pressed={mode === 'always'}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'always' ? 'bg-tone-green text-black' : 'bg-surface text-muted'}`}
            >
              자동 등록
            </button>
            <button
              type="button"
              onClick={() => onModeChange('never')}
              aria-pressed={mode === 'never'}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'never' ? 'bg-tone-red text-white' : 'bg-surface text-muted'}`}
            >
              표시 안 함
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl bg-surface text-muted text-sm font-bold"
          >
            나중에
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-action text-on-action text-sm font-bold hover:bg-action-hover transition-colors"
          >
            지금 등록
          </button>
        </div>
      </div>
    </div>
  )
}
