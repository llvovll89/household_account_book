import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Loan } from '../types'
import type { LoanStatus } from '../lib/loans'
import { fmt, generateId, toLocalDateStr } from '../lib/format'
import { useModalClose } from '../hooks/useModalClose'

interface Props {
  statuses: LoanStatus[]
  onSave: (loans: Loan[]) => void
  onClose: () => void
}

interface Draft {
  id?: string
  name: string
  remaining: string
}

// 대출 추가·수정·삭제. 남은 원금을 고치면 그날을 새 기준일로 삼는다
export function LoansModal({ statuses, onSave, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const [loans, setLoans] = useState(statuses.map((s) => s.loan))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const remainingById = new Map(statuses.map((s) => [s.loan.id, s.remaining]))

  function saveDraft() {
    if (!draft) return
    const name = draft.name.trim()
    const remaining = Number(draft.remaining.replace(/[^\d]/g, ''))
    if (!name) { setError('대출 이름을 입력하세요.'); return }
    if (!draft.remaining.trim() || !Number.isSafeInteger(remaining)) { setError('남은 원금을 숫자로 입력하세요.'); return }
    if (loans.some((l) => l.id !== draft.id && l.name === name)) { setError('같은 이름의 대출이 있어요.'); return }
    const previous = loans.find((l) => l.id === draft.id)
    const unchanged = previous && remainingById.get(previous.id) === remaining
    const next: Loan = previous
      ? { ...previous, name, ...(unchanged ? {} : { balance: remaining, balanceAsOf: toLocalDateStr() }) }
      : { id: generateId(), name, balance: remaining, balanceAsOf: toLocalDateStr(), createdAt: Date.now() }
    setLoans((prev) => (previous ? prev.map((l) => (l.id === next.id ? next : l)) : [...prev, next]))
    setDraft(null)
    setError('')
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50 modal-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="loans-modal-title" className="modal-panel w-full max-w-lg max-h-[90dvh] flex flex-col" {...(closing ? { 'data-closing': '' } : {})}>
        <header className="flex items-center justify-between p-6">
          <div>
            <h2 id="loans-modal-title" className="text-lg font-bold">대출 관리</h2>
            <p className="text-xs text-muted mt-1">'대출' 지출을 기록할 때 대출을 고르면 갚은 원금만큼 줄어요.</p>
          </div>
          <button className="dialog-icon-button" aria-label="대출 관리 닫기" onClick={handleClose}><X size={18} /></button>
        </header>
        <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-5 space-y-2">
          {loans.map((l) => (
            <div key={l.id} className="payment-method-row">
              <span className="min-w-0 flex-1 break-words">{l.name}</span>
              <span className="text-xs text-muted num">{remainingById.has(l.id) ? `남은 원금 ${fmt(remainingById.get(l.id) ?? 0)}원` : `${fmt(l.balance)}원`}</span>
              <button className="dialog-icon-button" aria-label={`${l.name} 수정`} onClick={() => { setDraft({ id: l.id, name: l.name, remaining: String(remainingById.get(l.id) ?? l.balance) }); setError('') }}><Pencil size={15} /></button>
              <button className="dialog-icon-button" aria-label={`${l.name} 삭제`} onClick={() => { setLoans((prev) => prev.filter((x) => x.id !== l.id)); if (draft?.id === l.id) setDraft(null) }}><Trash2 size={15} /></button>
            </div>
          ))}
          {loans.length === 0 && !draft && <p className="text-xs text-muted py-2">추적할 대출을 추가하세요.</p>}
          {!draft && <button className="secondary-action w-full mt-2" onClick={() => { setDraft({ name: '', remaining: '' }); setError('') }}><Plus size={15} />대출 추가</button>}
          {draft && (
            <section className="category-delete-preview" aria-label="대출 편집">
              <label htmlFor="loan-name" className="text-xs block mb-2">대출 이름</label>
              <input id="loan-name" autoFocus className="w-full p-3" value={draft.name} aria-describedby="loan-error" onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setError('') }} />
              <label htmlFor="loan-remaining" className="text-xs block mt-3 mb-2">오늘 기준 남은 원금 (원)</label>
              <input id="loan-remaining" inputMode="numeric" className="w-full p-3 num" value={draft.remaining} aria-describedby="loan-error" onChange={(e) => { setDraft({ ...draft, remaining: e.target.value }); setError('') }} />
              <p id="loan-error" role={error ? 'alert' : undefined} className="text-xs text-expense mt-2">{error}</p>
              <div className="flex gap-2 mt-3">
                <button className="secondary-action flex-1" onClick={() => setDraft(null)}>취소</button>
                <button className="primary-action flex-1" onClick={saveDraft}>{draft.id ? '수정 완료' : '추가 완료'}</button>
              </div>
            </section>
          )}
        </div>
        <footer className="dialog-footer"><button className="primary-action w-full" disabled={!!draft} onClick={() => { onSave(loans); handleClose() }}>저장</button></footer>
      </div>
    </div>
  )
}
