import { useState, useEffect, useMemo, useRef } from 'react'
import { useModalClose } from '../hooks/useModalClose'
import { X, Plus, CalendarRange, BookmarkPlus, Bookmark } from 'lucide-react'
import type { AutoCategoryRule, Transaction, TransactionType, PaymentMethod, UserPaymentMethod, TransactionTemplate } from '../types'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR, PAYMENT_METHODS } from '../types'
import FancyDatePicker from './FancyDatePicker'
import { uploadReceiptImage } from '../lib/receiptStorage'
import { showToast } from '../lib/toast'
import { auth } from '../firebase/firebase'
import { formatBillingRange, getBillingStage, getCardBillingRange, getStatementYMForCardExpense, isCreditPaymentMethod } from '../lib/cardBilling'
import { loadSettings } from '../lib/storage'
import { fmt, generateId, toLocalDateStr } from '../lib/format'
import { applyAutoCategory } from '../lib/autoCategoryRules'

interface Props {
  transaction?: Transaction | null
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>[]) => void
  onClose: () => void
  customExpenseCategories?: string[]
  customIncomeCategories?: string[]
  userPaymentMethods?: UserPaymentMethod[]
  transactionTemplates?: TransactionTemplate[]
  onSaveTemplates?: (templates: TransactionTemplate[]) => void
  onOpenCategoryModal?: () => void
  onOpenPaymentMethodsModal?: () => void
  autoCategoryRules?: AutoCategoryRule[]
  initialType?: TransactionType
}

type QueueItem = Omit<Transaction, 'id' | 'createdAt'>

function parseHashtags(text: string): string[] {
  const matches = text.match(/#([^\s#]+)/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1)))]
}

function fmtShortDate(date: string) {
  const [, m, d] = date.split('-')
  return `${parseInt(m)}.${d}`
}

export default function TransactionModal({ transaction, onSave, onClose, customExpenseCategories = [], customIncomeCategories = [], userPaymentMethods = [], transactionTemplates = [], onSaveTemplates, onOpenCategoryModal, onOpenPaymentMethodsModal, autoCategoryRules = [], initialType }: Props) {
  const amountInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const paymentMethodInitialized = useRef(false)
  const categoryManuallySet = useRef(false)
  const [type, setType] = useState<TransactionType>(transaction?.type ?? initialType ?? 'expense')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toLocalDateStr())
  const [dateEnd, setDateEnd] = useState('')
  const [showDateEnd, setShowDateEnd] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [receiptImageUrl, setReceiptImageUrl] = useState<string>('')
  const [cardBillingDay, setCardBillingDay] = useState(25)
  const [creditBillingDayInput, setCreditBillingDayInput] = useState('25')
  const [showTemplates, setShowTemplates] = useState(false)
  const [autoCategoryApplied, setAutoCategoryApplied] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(!!transaction)

  const isEditMode = !!transaction
  const { closing, handleClose } = useModalClose(onClose)
  const tags = parseHashtags(description)

  const categories = type === 'income'
    ? [...INCOME_CATEGORIES, ...customIncomeCategories]
    : [...EXPENSE_CATEGORIES, ...customExpenseCategories]

  useEffect(() => {
    if (!transaction && !paymentMethodInitialized.current && userPaymentMethods.length > 0) {
      paymentMethodInitialized.current = true
      const first = userPaymentMethods[0]
      setPaymentMethod(first.type as PaymentMethod)
      setSelectedMethodId(first.id)
      if (first.type === 'credit' && first.billingDay) {
        setCreditBillingDayInput(String(first.billingDay))
      }
    }
  }, [userPaymentMethods, transaction])

  useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setPaymentMethod(transaction.paymentMethod ?? 'cash')
      if (transaction.paymentMethodId) {
        setSelectedMethodId(transaction.paymentMethodId)
        const card = userPaymentMethods.find((m) => m.id === transaction.paymentMethodId)
        if (card?.billingDay) setCreditBillingDayInput(String(card.billingDay))
      } else if (typeof transaction.creditBillingDay === 'number') {
        setCreditBillingDayInput(String(transaction.creditBillingDay))
      }
      setAmount(transaction.amount.toLocaleString())
      setCategory(transaction.category)
      setDescription(transaction.description)
      setDate(transaction.date)
      if (transaction.dateEnd) {
        setDateEnd(transaction.dateEnd)
        setShowDateEnd(true)
      }
      if (transaction.receiptImageUrl) {
        setReceiptImageUrl(transaction.receiptImageUrl)
        setReceiptPreview(transaction.receiptImageUrl)
        setShowReceipt(true)
      }
      setShowAdvanced(true)
    } else {
      setShowAdvanced(false)
    }
  }, [transaction])

  useEffect(() => {
    if (!transaction) {
      const newCats = type === 'income'
        ? [...INCOME_CATEGORIES, ...customIncomeCategories]
        : [...EXPENSE_CATEGORIES, ...customExpenseCategories]
      if (!categoryManuallySet.current || !newCats.includes(category)) {
        setCategory(newCats[0])
        categoryManuallySet.current = false
      }
    }
  }, [type])

  useEffect(() => {
    let cancelled = false

    void loadSettings().then((settings) => {
      if (!cancelled) {
        const firstCredit = settings.userPaymentMethods.find((m) => m.type === 'credit')
        const defaultDay = firstCredit?.billingDay ?? settings.cardBillingDay ?? 25
        setCardBillingDay(defaultDay)
        if (!transaction) setCreditBillingDayInput(String(defaultDay))
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const billingPreview = useMemo(() => {
    if (type !== 'expense' || !isCreditPaymentMethod(paymentMethod)) return null
    const parsedBillingDay = parseInt(creditBillingDayInput, 10)
    const effectiveBillingDay = Number.isInteger(parsedBillingDay) && parsedBillingDay >= 1 && parsedBillingDay <= 31
      ? parsedBillingDay
      : cardBillingDay
    const statementYM = getStatementYMForCardExpense(date, effectiveBillingDay)
    const stage = getBillingStage(date.slice(0, 7), statementYM)
    const stageLabel = stage === 'current' ? '이번 청구' : stage === 'next' ? '다음 청구' : `${statementYM.slice(5)}월 청구`
    return {
      stage,
      stageLabel,
      statementYM,
      rangeLabel: formatBillingRange(getCardBillingRange(statementYM, effectiveBillingDay)),
      effectiveBillingDay,
    }
  }, [type, paymentMethod, date, cardBillingDay, creditBillingDayInput])

  useEffect(() => {
    if (showDateEnd || !!receiptPreview || !!description.trim()) {
      setShowAdvanced(true)
    }
  }, [showDateEnd, receiptPreview, description])

  function buildItem(): QueueItem | null {
    const parsed = parseInt(amount.replace(/,/g, ''), 10)
    if (!parsed || parsed <= 0) return null
    const item: QueueItem = { type, amount: parsed, paymentMethod, category, description, tags, date, receiptImageUrl }
    if (selectedMethodId) item.paymentMethodId = selectedMethodId
    if (type === 'expense' && isCreditPaymentMethod(paymentMethod) && billingPreview) {
      item.creditBillingDay = billingPreview.effectiveBillingDay
    }
    if (showDateEnd && dateEnd) item.dateEnd = dateEnd
    return item
  }

  function handleAddToQueue() {
    const item = buildItem()
    if (!item) return
    setQueue((prev) => [...prev, item])
    // 금액·설명·영수증만 리셋, 날짜·타입·카테고리 유지
    setAmount('')
    setDescription('')
    setDateEnd('')
    setShowDateEnd(false)
    setReceiptImageUrl('')
    setReceiptFile(null)
    setReceiptPreview(null)
    amountInputRef.current?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setUploading(true)
      let finalReceiptUrl = receiptImageUrl

      // 파일이 선택됨 → 업로드
      if (receiptFile && auth.currentUser) {
        finalReceiptUrl = await uploadReceiptImage(
          auth.currentUser.uid,
          transaction?.id || `receipt-${Date.now()}`,
          receiptFile
        )
        showToast('영수증이 업로드되었습니다')
      }

      const current = buildItem()
      // Apply receipt URL only to the current item; queue items keep their own
      const currentFinal = current ? { ...current, receiptImageUrl: finalReceiptUrl } : null
      const all = currentFinal ? [...queue, currentFinal] : [...queue]

      if (all.length === 0) return
      onSave(all)

      // 모달 닫기
      setReceiptPreview(null)
      setReceiptFile(null)
      setReceiptImageUrl('')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '저장 실패')
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveFromQueue(idx: number) {
    setQueue((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleAmountChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setAmount(digits ? Number(digits).toLocaleString() : '')
  }

  function removeTag(tag: string) {
    const newDesc = description
      .replace(new RegExp(`#${tag}(?=\\s|$)`, 'g'), '')
      .replace(/\s+/g, ' ')
      .trim()
    setDescription(newDesc)
  }

  function handleSaveAsTemplate() {
    const parsed = parseInt(amount.replace(/,/g, ''), 10)
    if (!parsed || !category) { showToast('금액과 카테고리를 입력하세요'); return }
    const label = description || category
    const tmpl: TransactionTemplate = {
      id: generateId(),
      label,
      type,
      amount: parsed,
      category,
      description,
      paymentMethod,
      paymentMethodId: selectedMethodId ?? undefined,
      createdAt: Date.now(),
    }
    onSaveTemplates?.([...transactionTemplates, tmpl])
    showToast('템플릿으로 저장됐어요')
  }

  function applyTemplate(tmpl: TransactionTemplate) {
    setType(tmpl.type)
    setAmount(tmpl.amount.toLocaleString())
    setCategory(tmpl.category)
    setDescription(tmpl.description)
    if (tmpl.paymentMethod) setPaymentMethod(tmpl.paymentMethod)
    if (tmpl.paymentMethodId) setSelectedMethodId(tmpl.paymentMethodId)
    setShowTemplates(false)
  }

  function deleteTemplate(id: string) {
    onSaveTemplates?.(transactionTemplates.filter(t => t.id !== id))
  }

  function toggleDateEnd() {
    if (showDateEnd) {
      setShowDateEnd(false)
      setDateEnd('')
    } else {
      setShowDateEnd(true)
      setDateEnd(date)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setReceiptPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
    setReceiptFile(file)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-[#1A1E30] w-full max-w-lg rounded-t-[28px] border-t border-white/6 max-h-[92vh] flex flex-col modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">
              {transaction ? '내역 수정' : '내역 추가'}
            </h2>
            {queue.length > 0 && (
              <p className="text-xs text-[#3D8EF8] font-semibold mt-0.5">대기 중 {queue.length}건</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!transaction && (
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                aria-label="템플릿"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showTemplates ? 'bg-[#3D8EF8]/20 text-[#3D8EF8]' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}
              >
                <Bookmark size={15} />
              </button>
            )}
            <button onClick={handleClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
              <X size={16} className="text-[#8B95A1]" />
            </button>
          </div>
        </div>

        {/* 템플릿 목록 */}
        {showTemplates && (
          <div className="mx-6 mb-3">
            {transactionTemplates.length === 0 ? (
              <p className="text-[12px] text-[#4E5968] text-center py-3">저장된 템플릿이 없어요</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {transactionTemplates.map((tmpl) => (
                  <div key={tmpl.id} className="flex items-center gap-1 bg-[#2C2C2E] rounded-2xl pl-3 pr-1.5 py-1.5">
                    <button type="button" onClick={() => applyTemplate(tmpl)} className="flex items-center gap-1.5">
                      <span className="text-sm">{CATEGORY_EMOJI[tmpl.category] ?? '📦'}</span>
                      <span className="text-[12px] font-semibold text-white">{tmpl.label}</span>
                      <span className="text-[11px] text-[#4E5968] num">{fmt(tmpl.amount)}원</span>
                    </button>
                    <button type="button" onClick={() => deleteTemplate(tmpl.id)} className="w-4 h-4 rounded-full bg-[#F25260]/15 flex items-center justify-center ml-1">
                      <X size={8} className="text-[#F25260]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {/* 대기열 */}
          {queue.length > 0 && (
            <div className="mx-6 mb-3 bg-[#252A3F] rounded-2xl overflow-hidden">
              {queue.map((item, idx) => {
                const qColor = CATEGORY_COLOR[item.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                const dateLabel = item.dateEnd
                  ? `${fmtShortDate(item.date)}~${fmtShortDate(item.dateEnd)}`
                  : fmtShortDate(item.date)
                return (
                  <div key={idx} className={`flex items-center gap-2.5 px-3 py-2.5 ${idx < queue.length - 1 ? 'border-b border-white/4' : ''}`}>
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: qColor.bg }}>
                      {CATEGORY_EMOJI[item.category] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-bold" style={{ color: item.type === 'income' ? '#2ACF6A' : '#F25260' }}>
                        {item.type === 'income' ? '+' : '-'}{fmt(item.amount)}원
                      </span>
                      <span className="text-[11px] text-[#4E5968] ml-1.5">{item.category}</span>
                      <span className="text-[11px] text-[#4E5968] ml-1">· {item.paymentMethod === 'cash' ? '현금' : item.paymentMethod === 'check' ? '체크카드' : '신용카드'}</span>
                      {item.description && (
                        <span className="text-[11px] text-[#4E5968] ml-1 truncate"> · {item.description}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#4E5968] shrink-0">{dateLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(idx)}
                      className="w-5 h-5 rounded-full bg-[#F25260]/15 flex items-center justify-center shrink-0"
                      aria-label="대기열에서 제거"
                    >
                      <X size={10} className="text-[#F25260]" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
            {/* 수입 / 지출 */}
            <div role="group" aria-label="거래 유형" className="flex gap-2 bg-[#252A3F] p-1 rounded-xl">
              <button type="button" onClick={() => setType('income')}
                aria-pressed={type === 'income'}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border ${type === 'income' ? 'bg-[#2ACF6A]/15 border-[#2ACF6A]/50 text-[#2ACF6A]' : 'border-transparent text-[#4E5968]'
                  }`}>
                수입
              </button>
              <button type="button" onClick={() => setType('expense')}
                aria-pressed={type === 'expense'}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border ${type === 'expense' ? 'bg-[#F25260]/15 border-[#F25260]/50 text-[#F25260]' : 'border-transparent text-[#4E5968]'
                  }`}>
                지출
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">결제수단</span>
                {onOpenPaymentMethodsModal && (
                  <button type="button" onClick={onOpenPaymentMethodsModal} className="text-[11px] font-semibold text-[#3D8EF8]">
                    관리하기 →
                  </button>
                )}
              </div>
              {userPaymentMethods.length > 0 ? (
                <div
                  role="group"
                  aria-label="결제 수단"
                  className={`bg-[#252A3F] p-1 rounded-xl ${userPaymentMethods.length > 4 ? 'grid grid-cols-3 gap-1' : 'flex gap-1'}`}
                >
                {userPaymentMethods.map((m) => {
                  const isSelected = selectedMethodId === m.id
                  const emoji = m.type === 'cash' ? '💵' : m.type === 'check' ? '💳' : '💎'
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMethodId(m.id)
                        setPaymentMethod(m.type as PaymentMethod)
                        if (m.type === 'credit' && m.billingDay) {
                          setCreditBillingDayInput(String(m.billingDay))
                        }
                      }}
                      aria-pressed={isSelected}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border truncate px-1 ${isSelected
                        ? m.type === 'cash'
                          ? 'bg-[#2ACF6A]/18 text-[#2ACF6A] border-[#2ACF6A]/35'
                          : 'bg-[#3D8EF8]/18 text-[#79B2FF] border-[#3D8EF8]/35'
                        : 'text-[#4E5968] border-transparent'
                      }`}
                    >
                      {emoji} {m.label}
                    </button>
                  )
                })}
                </div>
              ) : (
                <div role="group" aria-label="결제 수단" className="flex gap-2 bg-[#252A3F] p-1 rounded-xl">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => { setPaymentMethod(method.value); setSelectedMethodId(null) }}
                      aria-pressed={paymentMethod === method.value}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${paymentMethod === method.value
                        ? method.value === 'cash'
                          ? 'bg-[#2ACF6A]/18 text-[#2ACF6A] border-[#2ACF6A]/35'
                          : 'bg-[#3D8EF8]/18 text-[#79B2FF] border-[#3D8EF8]/35'
                        : 'text-[#4E5968] border-transparent'
                      }`}
                    >
                      {method.emoji} {method.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {billingPreview && (
              <div className={`rounded-2xl px-4 py-3 border ${billingPreview.stage === 'current'
                ? 'bg-[#F5BE3A]/12 border-[#F5BE3A]/25'
                : 'bg-[#3D8EF8]/12 border-[#3D8EF8]/25'
                }`}>
                <p className="text-[11px] font-semibold text-[#8B95A1] mb-1">카드 청구 미리보기</p>
                <p className={`text-sm font-bold ${billingPreview.stage === 'current' ? 'text-[#F5BE3A]' : 'text-[#79B2FF]'}`}>
                  {billingPreview.stageLabel}
                </p>
                <p className="text-[11px] text-[#8B95A1] mt-1">결제일 {billingPreview.effectiveBillingDay}일 기준 · {billingPreview.statementYM.replace('-', '년 ')}월 청구</p>
                <p className="text-[11px] text-[#8B95A1] mt-0.5">집계 기간: {billingPreview.rangeLabel}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#8B95A1]">결제일</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={creditBillingDayInput}
                    onChange={(e) => setCreditBillingDayInput(e.target.value)}
                    className="w-14 bg-[#2C2C2E] text-white text-center rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                  />
                  <span className="text-[11px] text-[#8B95A1]">일</span>
                </div>
              </div>
            )}

            {/* 금액 */}
            <div className="bg-[#252A3F] rounded-2xl px-5 py-4 overflow-hidden cursor-text" onClick={() => amountInputRef.current?.focus()}>
              <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">금액</p>
              <div className="flex items-baseline gap-2">
                <input
                  ref={amountInputRef}
                  type="text" inputMode="numeric"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  required={queue.length === 0}
                  className={`flex-1 min-w-0 bg-transparent text-[34px] font-extrabold focus:outline-none num text-right placeholder-[#1E2A3A] transition-colors ${type === 'income' ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}
                />
                <span className="text-lg font-bold text-[#4E5968] shrink-0">원</span>
              </div>
              <div className="flex gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                {[10000, 50000, 100000, 500000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      const current = parseInt(amount.replace(/,/g, ''), 10) || 0
                      handleAmountChange(String(current + v))
                    }}
                    className={`flex-1 py-1.5 rounded-xl bg-[#1A1E30] text-[11px] font-bold text-[#8B95A1] transition-colors ${type === 'income' ? 'active:bg-[#2ACF6A]/20 active:text-[#2ACF6A]' : 'active:bg-[#F25260]/20 active:text-[#F25260]'}`}
                  >
                    +{v >= 10000 ? `${v / 10000}만` : `${v / 1000}천`}
                  </button>
                ))}
                {amount && (
                  <button
                    type="button"
                    onClick={() => handleAmountChange('')}
                    className="px-3 py-1.5 rounded-xl bg-[#1A1E30] text-[11px] font-bold text-[#4E5968] active:text-[#F25260] transition-colors"
                  >
                    C
                  </button>
                )}
              </div>
            </div>

            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">날짜</p>
              <FancyDatePicker value={date} onChange={setDate} />
            </div>

            {/* 카테고리 그리드 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">카테고리</p>
                  {autoCategoryApplied && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">🤖 자동</span>
                  )}
                </div>
                {onOpenCategoryModal && (
                  <button type="button" onClick={onOpenCategoryModal} className="text-[11px] font-semibold text-[#3D8EF8] shrink-0">
                    관리하기 →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((c) => {
                  const cColor = CATEGORY_COLOR[c] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                  const isSelected = category === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCategory(c); categoryManuallySet.current = true; setAutoCategoryApplied(false) }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all border ${
                        isSelected ? 'border-current' : 'border-transparent bg-[#1A1E30] hover:bg-[#1E2438]'
                      }`}
                      style={isSelected ? { backgroundColor: cColor.bg, borderColor: `${cColor.text}50` } : {}}
                    >
                      <span className="text-[22px] leading-none">{CATEGORY_EMOJI[c] ?? '📦'}</span>
                      <span
                        className="text-[10px] font-bold leading-tight text-center w-full px-0.5 truncate"
                        style={{ color: isSelected ? cColor.text : '#8B95A1' }}
                      >
                        {c}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-[#252A3F] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚙️</span>
                  <span className="text-[13px] font-bold text-[#8B95A1]">상세 입력</span>
                  {(showDateEnd || receiptPreview || tags.length > 0) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">활성</span>
                  )}
                </div>
                <span className={`text-[11px] font-bold transition-colors ${showAdvanced ? 'text-[#3D8EF8]' : 'text-[#4E5968]'}`}>
                  {showAdvanced ? '접기' : '펼치기'}
                </span>
              </button>
            </div>

            {showAdvanced && (
              <>
                <div className="bg-[#252A3F] rounded-2xl px-5 py-4 space-y-2">
                  <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">
                    메모 (선택) · <span className="text-[#3D8EF8]">#해시태그</span> 사용 가능
                  </p>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      const val = e.target.value
                      setDescription(val)
                      if (!categoryManuallySet.current && autoCategoryRules.length > 0) {
                        const matched = applyAutoCategory(val, type, autoCategoryRules)
                        if (matched) { setCategory(matched); setAutoCategoryApplied(true) }
                        else setAutoCategoryApplied(false)
                      }
                    }}
                    placeholder={"어디서 사용했나요?\n#태그도 함께 입력해보세요"}
                    rows={3}
                    className="w-full bg-transparent text-[14px] font-medium text-white placeholder-[#2D3352] focus:outline-none resize-none leading-relaxed"
                  />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#3D8EF8]/15 text-[#3D8EF8]"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            aria-label={`#${tag} 태그 삭제`}
                            className="hover:text-white transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">기간 설정 (선택)</p>
                    <button
                      type="button"
                      onClick={toggleDateEnd}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${showDateEnd ? 'bg-[#3D8EF8]/20 text-[#3D8EF8]' : 'bg-[#2C2C2E] text-[#4E5968] hover:text-[#8B95A1]'
                        }`}
                    >
                      <CalendarRange size={11} />
                      {showDateEnd ? '기간 사용 중' : '기간 설정'}
                    </button>
                  </div>
                  {showDateEnd && (
                    <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
                      <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">종료일</p>
                      <FancyDatePicker value={dateEnd || date} onChange={setDateEnd} min={date} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 영수증 첨부 (접기/펼치기) */}
            <div className="bg-[#252A3F] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowReceipt((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{receiptPreview ? '📷' : '🧾'}</span>
                  <span className="text-[13px] font-bold text-[#8B95A1]">영수증 첨부</span>
                  {receiptPreview && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">첨부됨</span>}
                </div>
                <span className={`text-[11px] font-bold transition-colors ${showReceipt ? 'text-[#3D8EF8]' : 'text-[#4E5968]'}`}>
                  {showReceipt ? '접기' : '펼치기'}
                </span>
              </button>

              {showReceipt && (
                <div className="px-4 pb-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${uploading
                        ? 'bg-[#4E5968] text-[#8B95A1] cursor-not-allowed'
                        : 'bg-[#3D8EF8]/20 hover:bg-[#3D8EF8]/30 text-[#3D8EF8]'
                      }`}
                  >
                    {uploading ? <>⏳ 업로드 중...</> : receiptPreview ? <>✓ 다시 선택</> : <>📷 사진 선택</>}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  {receiptPreview && (
                    <div className="relative rounded-xl overflow-hidden border border-[#3D8EF8]/30">
                      <img src={receiptPreview} alt="영수증 미리보기" className="w-full" />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptPreview(null)
                          setReceiptFile(null)
                          setReceiptImageUrl('')
                        }}
                        className="absolute top-2 right-2 bg-[#F25260]/80 hover:bg-[#F25260] rounded-full p-2 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 영역 */}
            {isEditMode ? (
              <button type="submit" disabled={uploading}
                className={`w-full py-4 rounded-2xl font-bold text-white text-[15px] disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${type === 'income' ? 'bg-[#1A8C4E] hover:bg-[#1FA05A]' : 'bg-[#C0394A] hover:bg-[#D44257]'}`}>
                {uploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {uploading ? '저장 중...' : '수정 완료'}
              </button>
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    disabled={uploading}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] bg-[#2C2C2E] text-[#8B95A1] hover:bg-[#3A3A3C] disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={15} />
                    항목 추가
                  </button>
                  <button type="submit" disabled={uploading}
                    className={`font-bold text-white text-[14px] rounded-2xl active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2 ${queue.length > 0 ? 'flex-[1.5] py-3.5' : 'flex-1 py-3.5'} ${type === 'income' ? 'bg-[#1A8C4E] hover:bg-[#1FA05A]' : 'bg-[#C0394A] hover:bg-[#D44257]'}`}>
                    {uploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {uploading ? '저장 중...' : queue.length > 0 ? `전체 저장 (${queue.length + (amount ? 1 : 0)}건)` : type === 'income' ? '수입 추가' : '지출 추가'}
                  </button>
                </div>
                {onSaveTemplates && (
                  <button
                    type="button"
                    onClick={handleSaveAsTemplate}
                    className="w-full py-2.5 rounded-2xl font-semibold text-[13px] bg-[#2C2C2E] text-[#4E5968] hover:text-[#8B95A1] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <BookmarkPlus size={13} />
                    템플릿으로 저장
                  </button>
                )}
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
