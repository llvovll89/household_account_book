import { useState } from 'react'
import { X, Plus, Pencil, Trash2, Landmark, CreditCard, Banknote } from 'lucide-react'
import type { UserPaymentMethod } from '../types'
import { PAYMENT_METHOD_LABEL } from '../types'
import { fmt, generateId, toLocalDateStr } from '../lib/format'
import { useModalClose } from '../hooks/useModalClose'

interface Props { userPaymentMethods: UserPaymentMethod[]; onSave: (methods: UserPaymentMethod[]) => void; onClose: () => void }
type EditableType = 'check' | 'credit' | 'transfer'
type DraftType = EditableType | 'cash'

// 잔액은 비워두면 추적하지 않는다. 숫자만 남기고 앞의 '-'(마이너스 통장)는 허용
function parseBalance(input: string): number | null {
  const cleaned = input.replace(/[^\d-]/g, '')
  if (!/^-?\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isSafeInteger(value) ? value : null
}
export default function PaymentMethodsModal({ userPaymentMethods, onSave, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const [methods, setMethods] = useState(userPaymentMethods)
  const [draft, setDraft] = useState<{ id?: string; type: DraftType; label: string; day: string; balance: string } | null>(null)
  const [error, setError] = useState('')
  function saveDraft() {
    if (!draft) return
    const label = draft.label.trim()
    const day = Number(draft.day)
    if (!label) { setError('결제수단 이름을 입력하세요.'); return }
    if (methods.some(m => m.id !== draft.id && m.type === draft.type && m.label === label)) { setError('같은 이름의 결제수단이 있어요.'); return }
    if (draft.type === 'credit' && (!Number.isInteger(day) || day < 1 || day > 31)) { setError('결제일은 1~31 사이로 입력하세요.'); return }
    const balanceText = draft.balance.trim()
    const balance = balanceText ? parseBalance(balanceText) : null
    if (balanceText && balance === null) { setError('잔액은 숫자로 입력하세요.'); return }
    const previous = methods.find(m => m.id === draft.id)
    // 잔액을 새로 입력했거나 바꿨을 때만 기준일을 오늘로 옮긴다
    const balanceFields = draft.type !== 'credit' && balance !== null
      ? { openingBalance: balance, balanceAsOf: previous?.openingBalance === balance && previous.balanceAsOf ? previous.balanceAsOf : toLocalDateStr() }
      : {}
    const next: UserPaymentMethod = { id: draft.id ?? (draft.type === 'cash' ? 'cash' : generateId()), type: draft.type, label, ...(draft.type === 'credit' ? { billingDay: day } : {}), ...balanceFields }
    setMethods(prev => prev.some(m => m.id === next.id) ? prev.map(m => m.id === next.id ? next : m) : [...prev, next]); setDraft(null); setError('')
  }
  function save() {
    const result = [...methods]
    if (!result.some(m => m.type === 'cash')) result.unshift({ id: 'cash', type: 'cash', label: '현금' })
    if (!result.some(m => m.type === 'transfer')) result.push({ id: 'transfer', type: 'transfer', label: '계좌이체' })
    onSave(result); handleClose()
  }
  return <div className="fixed inset-0 flex items-end justify-center z-50 modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" onClick={e => e.target === e.currentTarget && handleClose()}>
    <div ref={modalRef} className="modal-panel w-full max-w-lg max-h-[90dvh] flex flex-col" {...(closing ? { 'data-closing': '' } : {})}>
      <header role="presentation" className="flex items-center justify-between p-6"><div><h2 id="payment-modal-title" className="text-lg font-bold">결제수단 관리</h2><p className="text-xs text-muted mt-1">카드와 자동이체 계좌를 구분해 기록하세요.</p></div><button className="dialog-icon-button" aria-label="결제수단 관리 닫기" onClick={handleClose}><X size={18} /></button></header>
      <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-5 space-y-5">
        {(() => {
          const cash = methods.find(m => m.type === 'cash') ?? { id: 'cash', type: 'cash' as const, label: '현금' }
          return <div className="payment-method-row"><Banknote size={18} /><span>현금</span>
            <span className="text-xs text-muted ml-auto num">{typeof cash.openingBalance === 'number' ? `잔액 ${fmt(cash.openingBalance)}원 기준` : '기본'}</span>
            <button className="dialog-icon-button" aria-label="현금 잔액 수정" onClick={() => { setDraft({ id: cash.id, type: 'cash', label: '현금', day: '25', balance: typeof cash.openingBalance === 'number' ? String(cash.openingBalance) : '' }); setError('') }}><Pencil size={15} /></button>
          </div>
        })()}
        {(['transfer', 'check', 'credit'] as EditableType[]).map(type => <section key={type}>
          <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold">{PAYMENT_METHOD_LABEL[type]}</h3><button className="secondary-action" aria-label={`${PAYMENT_METHOD_LABEL[type]} 추가`} onClick={() => { setDraft({ type, label: '', day: '25', balance: '' }); setError('') }}><Plus size={15} />추가</button></div>
          {methods.filter(m => m.type === type).map(m => <div key={m.id} className="payment-method-row">
            {type === 'transfer' ? <Landmark size={18} /> : <CreditCard size={18} />}<span className="min-w-0 flex-1 break-words">{m.label}</span>{type === 'credit' ? <span className="text-xs text-muted">매월 {m.billingDay ?? 25}일</span> : typeof m.openingBalance === 'number' && <span className="text-xs text-muted num">잔액 {fmt(m.openingBalance)}원 기준</span>}
            <button className="dialog-icon-button" aria-label={`${m.label} 수정`} onClick={() => { setDraft({ id: m.id, type, label: m.label, day: String(m.billingDay ?? 25), balance: typeof m.openingBalance === 'number' ? String(m.openingBalance) : '' }); setError('') }}><Pencil size={15} /></button>
            <button className="dialog-icon-button" aria-label={`${m.label} 삭제`} onClick={() => { setMethods(prev => prev.filter(item => item.id !== m.id)); if (draft?.id === m.id) setDraft(null) }}><Trash2 size={15} /></button>
          </div>)}
          {!methods.some(m => m.type === type) && <p className="text-xs text-muted py-2">{type === 'transfer' ? '계좌를 추가하지 않아도 기본 계좌이체로 기록할 수 있어요.' : '사용하는 카드를 추가하세요.'}</p>}
        </section>)}
        {draft && <section className="category-delete-preview" aria-label="결제수단 편집">
          <h3 className="text-sm font-bold mb-3">{PAYMENT_METHOD_LABEL[draft.type]} {draft.id ? '수정' : '추가'}</h3>
          {draft.type !== 'cash' && <><label htmlFor="payment-method-name" className="text-xs block mb-2">결제수단 이름</label><input id="payment-method-name" autoFocus className="w-full p-3" value={draft.label} aria-invalid={!!error} aria-describedby="payment-method-error" onChange={e => { setDraft({ ...draft, label: e.target.value }); setError('') }} /></>}
          {draft.type !== 'credit' && <><label htmlFor="payment-balance" className="text-xs block mt-3 mb-2">오늘 기준 잔액 (선택)</label><input id="payment-balance" inputMode="numeric" autoFocus={draft.type === 'cash'} placeholder="비워두면 잔액을 추적하지 않아요" className="w-full p-3 num" value={draft.balance} aria-describedby="payment-balance-help payment-method-error" onChange={e => { setDraft({ ...draft, balance: e.target.value }); setError('') }} /><p id="payment-balance-help" className="text-[11px] text-muted mt-1.5">오늘까지의 기록은 이 금액에 포함된 것으로 보고, 이후 기록으로 잔액을 계산해요.</p></>}
          {draft.type === 'credit' && <><label htmlFor="payment-billing-day" className="text-xs block mt-3 mb-2">매월 결제일</label><input id="payment-billing-day" type="number" min={1} max={31} className="w-full p-3" value={draft.day} onChange={e => setDraft({ ...draft, day: e.target.value })} /></>}
          <p id="payment-method-error" role={error ? 'alert' : undefined} className="text-xs text-expense mt-2">{error}</p><div className="flex gap-2 mt-3"><button className="secondary-action flex-1" onClick={() => setDraft(null)}>취소</button><button className="primary-action flex-1" onClick={saveDraft}>{draft.id ? '수정 완료' : '추가 완료'}</button></div>
        </section>}
      </div>
      <footer role="presentation" className="dialog-footer"><button className="primary-action w-full" disabled={!!draft} onClick={save}>저장</button></footer>
    </div>
  </div>
}
