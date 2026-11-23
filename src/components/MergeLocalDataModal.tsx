import { useRef } from 'react'
import { Database } from 'lucide-react'
import type { LocalDataCounts } from '../lib/storage'
import { useModalClose } from '../hooks/useModalClose'

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
  { key: 'subscriptions', label: '구독' },
  { key: 'goals', label: '목표' },
]

export default function MergeLocalDataModal({ onConfirm, onCancel, counts }: Props) {
  const mergeButtonRef = useRef<HTMLButtonElement>(null)
  // onCancel clears local records; dismissal must never trigger that decision.
  const { modalRef } = useModalClose(() => {}, { initialFocusRef: mergeButtonRef, onBeforeClose: () => false })
  const items = COUNT_LABELS.filter(({ key }) => counts[key] > 0)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-local-data-modal-title"
    >
      <div ref={modalRef} className="w-full sm:max-w-sm bg-raised border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-tone-blue/15 border border-tone-blue/25 flex items-center justify-center shrink-0">
              <Database size={17} className="text-accent" />
            </span>
            <div>
              <h3 id="merge-local-data-modal-title" className="text-white text-base font-bold">로컬 데이터 발견</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                로그인 전 저장된 데이터를 Firebase 계정과 병합할까요?
              </p>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="bg-surface rounded-2xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map(({ key, label }) => (
              <span key={key} className="text-xs text-muted">
                {label} <span className="text-white font-bold num">{counts[key]}</span>건
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted leading-relaxed">
          병합하지 않고 계속하면 로컬 데이터는 앱에서 사라지며, 이후 앱 내에서 다시 확인할 수 없습니다.
        </p>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-surface text-muted text-sm font-bold">
            삭제 후 계속
          </button>
          <button ref={mergeButtonRef} onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-action text-on-action text-sm font-bold hover:bg-action-hover transition-colors">
            병합하기
          </button>
        </div>
      </div>
    </div>
  )
}
