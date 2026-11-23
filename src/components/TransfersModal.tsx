import { useState } from 'react'
import { ArrowRight, Trash2, X } from 'lucide-react'
import type { AccountTransfer, UserPaymentMethod } from '../types'
import { fmt, generateId, toLocalDateStr } from '../lib/format'
import { useModalClose } from '../hooks/useModalClose'

interface Props {
  methods: UserPaymentMethod[]
  transfers: AccountTransfer[]
  onSave: (transfers: AccountTransfer[]) => void
  onClose: () => void
}

/** 내 계좌 간 이체·카드대금 납부 기록. 수입·지출 통계에는 들어가지 않고 계좌 잔액에만 반영된다 */
export function TransfersModal({ methods, transfers, onSave, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const sources = methods.filter((m) => m.type !== 'credit')
  const [list, setList] = useState(transfers)
  const [fromId, setFromId] = useState(sources[0]?.id ?? '')
  const [toId, setToId] = useState(methods.find((m) => m.id !== sources[0]?.id)?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toLocalDateStr())
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')
  const labelOf = (id: string) => methods.find((m) => m.id === id)?.label ?? '삭제된 결제수단'

  function add() {
    const value = Number(amount.replace(/[^\d]/g, ''))
    if (!fromId || !toId) { setError('보낸 곳과 받은 곳을 고르세요.'); return }
    if (fromId === toId) { setError('보낸 곳과 받은 곳이 같아요.'); return }
    if (!Number.isSafeInteger(value) || value <= 0) { setError('금액을 숫자로 입력하세요.'); return }
    const next: AccountTransfer = { id: generateId(), date, amount: value, fromId, toId, createdAt: Date.now(), ...(memo.trim() ? { memo: memo.trim() } : {}) }
    setList((prev) => [next, ...prev])
    setAmount('')
    setMemo('')
    setError('')
  }

  const recent = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 30)

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50 modal-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="transfers-modal-title" className="modal-panel w-full max-w-lg max-h-[90dvh] flex flex-col" {...(closing ? { 'data-closing': '' } : {})}>
        <header className="flex items-center justify-between p-6">
          <div>
            <h2 id="transfers-modal-title" className="text-lg font-bold">계좌 이체</h2>
            <p className="text-xs text-muted mt-1">내 계좌 사이 이동과 카드대금 납부는 수입·지출이 아니라 잔액만 옮겨요.</p>
          </div>
          <button className="dialog-icon-button" aria-label="계좌 이체 닫기" onClick={handleClose}><X size={18} /></button>
        </header>
        <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-5 space-y-4">
          {sources.length === 0 ? (
            <p className="text-xs text-muted">결제수단 관리에서 계좌를 먼저 추가하세요.</p>
          ) : (
            <section className="category-delete-preview space-y-3" aria-label="이체 추가">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="text-xs block">보낸 곳
                  <select className="w-full p-3 mt-2" value={fromId} onChange={(e) => { setFromId(e.target.value); setError('') }}>
                    {sources.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <ArrowRight size={16} className="text-muted mb-3.5" aria-hidden="true" />
                <label className="text-xs block">받은 곳
                  <select className="w-full p-3 mt-2" value={toId} onChange={(e) => { setToId(e.target.value); setError('') }}>
                    {methods.map((m) => <option key={m.id} value={m.id}>{m.type === 'credit' ? `${m.label} (카드대금)` : m.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs block">금액 (원)
                  <input inputMode="numeric" className="w-full p-3 mt-2 num" value={amount} aria-describedby="transfer-error" onChange={(e) => { setAmount(e.target.value); setError('') }} />
                </label>
                <label className="text-xs block">날짜
                  <input type="date" className="w-full p-3 mt-2" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              </div>
              <label className="text-xs block">메모 (선택)
                <input className="w-full p-3 mt-2" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </label>
              <p id="transfer-error" role={error ? 'alert' : undefined} className="text-xs text-expense">{error}</p>
              <button className="secondary-action w-full" onClick={add}>이체 추가</button>
            </section>
          )}
          {recent.length > 0 && (
            <ul className="space-y-1.5" aria-label="최근 이체">
              {recent.map((t) => (
                <li key={t.id} className="payment-method-row">
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block text-muted num">{t.date}{t.memo ? ` · ${t.memo}` : ''}</span>
                    {labelOf(t.fromId)} → {labelOf(t.toId)}
                  </span>
                  <span className="text-sm font-semibold num">{fmt(t.amount)}원</span>
                  <button className="dialog-icon-button" aria-label={`${t.date} ${fmt(t.amount)}원 이체 삭제`} onClick={() => setList((prev) => prev.filter((x) => x.id !== t.id))}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="dialog-footer"><button className="primary-action w-full" onClick={() => { onSave(list); handleClose() }}>저장</button></footer>
      </div>
    </div>
  )
}
