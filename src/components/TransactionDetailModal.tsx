import { useEffect, useState } from 'react'
import { X, Pencil, Trash2 } from 'lucide-react'
import type { Transaction, UserPaymentMethod } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'
import { fmt, parseYmdLocal } from '../lib/format'
import { loadSettings } from '../lib/storage'
import { getStatementYMForCardExpense, isCreditPaymentMethod, resolveCardBillingDay, resolvePaymentMethod } from '../lib/cardBilling'

interface Props {
  transaction: Transaction
  userPaymentMethods?: UserPaymentMethod[]
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function formatDate(dateStr: string) {
  const d = parseYmdLocal(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
}

function formatShortDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

export default function TransactionDetailModal({ transaction: t, userPaymentMethods = [], onEdit, onDelete, onClose }: Props) {
  const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
  const tags = t.tags ?? []
  const isIncome = t.type === 'income'
  const amountColor = isIncome ? '#2ACF6A' : '#F25260'
  const [cardBillingDay, setCardBillingDay] = useState(25)

  useEffect(() => {
    let cancelled = false

    void loadSettings().then((settings) => {
      if (!cancelled) {
        const firstCredit = settings.userPaymentMethods.find((m) => m.type === 'credit')
        setCardBillingDay(firstCredit?.billingDay ?? settings.cardBillingDay ?? 25)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const resolvedMethod = resolvePaymentMethod(t, userPaymentMethods)
  const statementYM = t.type === 'expense' && isCreditPaymentMethod(t.paymentMethod)
    ? getStatementYMForCardExpense(t.date, resolveCardBillingDay(t, userPaymentMethods, cardBillingDay))
    : null

  function handleEdit() {
    onEdit(t)
    onClose()
  }

  function handleDelete() {
    onDelete(t.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] border-t border-white/6 max-h-[88vh] flex flex-col modal-panel">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
          <h2 className="text-[17px] font-bold text-white">내역 상세</h2>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-3">
          {/* 카테고리 + 금액 */}
          <div className="rounded-3xl px-5 py-5 flex items-center gap-4" style={{ backgroundColor: color.bg }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 bg-black/20">
              {CATEGORY_EMOJI[t.category] ?? '📦'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-bold" style={{ color: color.text }}>{t.category}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-black/20 font-bold" style={{ color: color.text }}>
                  {resolvedMethod.type === 'cash' ? '💵' : resolvedMethod.type === 'check' ? '💳' : '💎'} {resolvedMethod.label}
                </span>
              </div>
              <p className="text-[30px] font-extrabold num leading-tight mt-1" style={{ color: amountColor }}>
                {isIncome ? '+' : '-'}{fmt(t.amount)}<span className="text-[16px] ml-1 font-bold opacity-70">원</span>
              </p>
              <p className="text-[12px] font-medium mt-1 text-white/60">
                {t.dateEnd
                  ? `${formatShortDate(t.date)} ~ ${formatShortDate(t.dateEnd)}`
                  : formatDate(t.date)}
              </p>
              {statementYM && (() => {
                const [y, m] = statementYM.split('-')
                return <p className="text-[11px] font-bold mt-1 text-white/50">{y}년 {parseInt(m)}월 청구 기준</p>
              })()}
            </div>
          </div>

          {/* 메모 */}
          {t.description && (
            <div className="bg-[#2C2C2E] rounded-2xl px-5 py-4 space-y-1.5">
              <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">메모</p>
              <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{t.description}</p>
            </div>
          )}

          {/* 태그 */}
          {tags.length > 0 && (
            <div className="bg-[#2C2C2E] rounded-2xl px-5 py-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">태그</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[#3D8EF8]/15 text-[#3D8EF8]">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 영수증 */}
          {t.receiptImageUrl && (
            <div className="bg-[#2C2C2E] rounded-2xl px-5 py-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">영수증</p>
              <div className="rounded-xl overflow-hidden border border-white/8">
                <img src={t.receiptImageUrl} alt="영수증" className="w-full max-h-72 object-contain bg-black/20" />
              </div>
            </div>
          )}

          {/* 수정 / 삭제 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleEdit}
              className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] bg-[#3D8EF8] text-white hover:bg-[#5AA0FF] active:scale-[0.98] transition-all"
            >
              <Pencil size={15} />
              수정하기
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] bg-[#2C2C2E] text-[#F25260] hover:bg-[#F25260]/15 active:scale-[0.98] transition-all"
            >
              <Trash2 size={15} />
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
