import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Transaction } from '../types'
import { fmt } from '../lib/format'
import { useModalClose } from '../hooks/useModalClose'

export interface TransactionReviewScope { title: string; start: string; end: string; category?: string }
interface Props { transactions: Transaction[]; scope: TransactionReviewScope; onEdit?: (transaction: Transaction) => void; onClose: () => void }

export default function TransactionReviewModal({ transactions, scope, onEdit, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const [visible, setVisible] = useState(20)
  const items = useMemo(() => transactions.filter(t => t.type === 'expense' && t.date >= scope.start && t.date <= scope.end && (!scope.category || t.category === scope.category))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [transactions, scope])
  const total = items.reduce((sum, t) => sum + t.amount, 0)
  return <div role="dialog" aria-modal="true" aria-labelledby="review-transactions-title" className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop" onClick={e => e.target === e.currentTarget && handleClose()}>
    <div ref={modalRef} className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[85dvh] flex flex-col border-t border-white/6 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
      <div className="flex justify-center pt-3"><div className="w-9 h-1 bg-white/10 rounded-full" /></div>
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div><h2 id="review-transactions-title" className="text-[18px] font-bold text-white">{scope.title}</h2><p className="text-xs text-[#8B95A1] mt-1">{scope.start.replaceAll('-', '.')}–{scope.end.replaceAll('-', '.')}</p></div>
        <button type="button" aria-label="지출 내역 닫기" onClick={handleClose} className="w-11 h-11 shrink-0 flex items-center justify-center"><X size={18} /></button>
      </div>
      <div className="px-6 pb-4"><p className="text-xl font-bold text-white num">{fmt(total)}원 <span className="text-xs font-normal text-[#8B95A1]">· {items.length}건</span></p><p className="text-xs text-[#8B95A1] mt-1">기록한 지출 기준이에요. 내역을 누르면 수정할 수 있어요.</p></div>
      <div className="overflow-y-auto px-6 pb-6">
        {items.length === 0 ? <p className="text-sm text-[#8B95A1] py-5">이 기간에 해당하는 지출 내역이 없어요.</p> : <ul className="divide-y divide-white/6">{items.slice(0, visible).map(t => <li key={t.id}>
          <button type="button" disabled={!onEdit} onClick={() => { onClose(); onEdit?.(t) }} aria-label={`${t.date} ${t.description || t.category} ${fmt(t.amount)}원 내역 수정`} className="w-full min-h-16 flex items-center justify-between gap-3 py-3 text-left rounded-lg hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#3D8EF8]">
            <span className="min-w-0"><span className="block text-sm font-semibold text-white break-words">{t.description || t.category}</span><span className="block text-xs text-[#8B95A1] mt-1">{t.date.slice(5).replace('-', '.')} · {t.category}</span></span>
            <strong className="num shrink-0 text-sm text-[#F25260]">{fmt(t.amount)}원</strong>
          </button>
        </li>)}</ul>}
        {items.length > visible && <button type="button" onClick={() => setVisible(v => v + 20)} className="home-text-button">내역 더 보기 ({visible}/{items.length})</button>}
      </div>
    </div>
  </div>
}
