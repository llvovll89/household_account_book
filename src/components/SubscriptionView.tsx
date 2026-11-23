import { useEffect, useState } from 'react'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import type { Subscription } from '../types'
import { EXPENSE_CATEGORIES, CATEGORY_COLOR } from '../types'
import { fmt, fmtPrice } from '../lib/format'
import { generateId } from '../lib/format'
import EmptyState from './ui/EmptyState'
import { getDaysUntilNextBilling, getMonthlyKrw, getSubscriptionTotals, isYearly } from '../lib/subscriptions'
import { loadSettings, saveSettings } from '../lib/storage'
import { showToast } from '../lib/toast'
import { InlineDialog } from './ui/InlineDialog'

interface Props {
  subscriptions: Subscription[]
  addTrigger?: number
  onChange: (items: Subscription[]) => void
}

const SERVICE_COLORS = [
  '#3D8EF8', '#F25260', '#2ACF6A', '#F5BE3A',
  '#9B7EFF', '#F06EC4', '#00D4FF', '#FFA02E',
]

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function daysUntilBilling(sub: Subscription): number {
  return getDaysUntilNextBilling(sub, new Date())
}

const EMPTY: Omit<Subscription, 'id' | 'createdAt'> = {
  name: '',
  amount: 0,
  currency: 'KRW',
  billingDay: 1,
  cycle: 'monthly',
  category: '통신비',
  memo: '',
}

export default function SubscriptionView({ subscriptions, addTrigger, onChange }: Props) {
  const [showSheet, setShowSheet] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [amountStr, setAmountStr] = useState('')
  const [colorIdx, setColorIdx] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [previousAddTrigger, setPreviousAddTrigger] = useState(addTrigger)

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY })
    setAmountStr('')
    setColorIdx(subscriptions.length % SERVICE_COLORS.length)
    setErrors({})
    setShowSheet(true)
  }

  // 부모의 추가 요청이 바뀐 경우에만 새 입력 폼을 연다.
  if (addTrigger !== previousAddTrigger) {
    setPreviousAddTrigger(addTrigger)
    if (addTrigger && addTrigger > 0) openAdd()
  }

  function openEdit(sub: Subscription) {
    setEditing(sub)
    setForm({
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency,
      billingDay: sub.billingDay,
      cycle: sub.cycle ?? 'monthly',
      billingMonth: sub.billingMonth,
      category: sub.category,
      memo: sub.memo,
    })
    setAmountStr(sub.amount > 0 ? String(sub.amount) : '')
    const idx = SERVICE_COLORS.indexOf(sub.color ?? SERVICE_COLORS[0])
    setColorIdx(idx >= 0 ? idx : 0)
    setErrors({})
    setShowSheet(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '서비스명을 입력해주세요'
    if (!amountStr || Number(amountStr) <= 0) e.amount = '금액을 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const amount = Number(amountStr)
    const color = SERVICE_COLORS[colorIdx]
    // 매월 구독에는 결제 월을 남기지 않는다
    const cycleFields = form.cycle === 'yearly'
      ? { cycle: 'yearly' as const, billingMonth: form.billingMonth ?? new Date().getMonth() + 1 }
      : { cycle: 'monthly' as const, billingMonth: undefined }

    if (editing) {
      onChange(subscriptions.map(s =>
        s.id === editing.id ? { ...s, ...form, ...cycleFields, amount, color } : s
      ))
    } else {
      const next: Subscription = {
        id: generateId(),
        ...form,
        ...cycleFields,
        amount,
        color,
        createdAt: Date.now(),
      }
      onChange([...subscriptions, next])
    }
    setShowSheet(false)
  }

  function handleDelete(id: string) {
    setConfirmingId(id)
  }

  function confirmDelete(id: string) {
    onChange(subscriptions.filter(s => s.id !== id))
    setConfirmingId(null)
  }

  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const sorted = [...subscriptions].sort((a, b) => a.billingDay - b.billingDay)
  // USD 구독을 원화 합계에 넣기 위한 환율 (설정에 저장)
  const [usdKrwRate, setUsdKrwRate] = useState<number | undefined>(undefined)
  const [rateInput, setRateInput] = useState('')
  useEffect(() => {
    let cancelled = false
    void loadSettings().then((settings) => {
      if (cancelled) return
      setUsdKrwRate(settings.usdKrwRate)
      setRateInput(settings.usdKrwRate ? String(settings.usdKrwRate) : '')
    })
    return () => { cancelled = true }
  }, [])
  async function saveRate() {
    const value = Number(rateInput.replace(/[^\d.]/g, ''))
    const next = rateInput.trim() && Number.isFinite(value) && value > 0 ? value : undefined
    if (next === usdKrwRate) return
    setUsdKrwRate(next)
    try {
      const current = await loadSettings()
      await saveSettings({ ...current, usdKrwRate: next })
    } catch {
      showToast('환율 저장에 실패했어요. 다시 시도해주세요.', 3000, 'error')
    }
  }

  const hasUsd = subscriptions.some(s => s.currency === 'USD')
  const totals = getSubscriptionTotals(subscriptions, usdKrwRate)
  const totalKrw = totals.monthlyKrw
  const annualKrw = totals.annualKrw

  return (
    <div className="space-y-3 tab-content">
      {/* 월 합계 카드 */}
      <div className="bg-surface rounded-2xl p-5">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">월 구독 비용</p>
        {subscriptions.length === 0 ? (
          <EmptyState
            emoji="💳"
            title="구독 서비스를 추가해보세요"
            description="넷플릭스, 유튜브 프리미엄 같은 고정비를 먼저 등록하면 월 지출을 더 정확히 볼 수 있어요."
            action={{ label: '구독 추가', onClick: openAdd }}
            className="py-6 px-2"
          />
        ) : (
          <>
            <div className="flex items-end gap-3 flex-wrap mb-3">
              {totalKrw > 0 && (
                <p className="text-2xl font-bold text-white num">{fmt(totalKrw)}<span className="text-sm ml-1 text-muted">원</span></p>
              )}
              {totals.unconvertedUsd > 0 && (
                <p className="text-2xl font-bold text-white num">${totals.unconvertedUsd.toFixed(2)}</p>
              )}
              <p className="text-[11px] text-muted mb-1">{subscriptions.length}개 서비스 · 연간 결제는 12개월로 나눔</p>
            </div>
            {hasUsd && (
              <label className="flex items-center gap-2 mb-3 text-[11px] text-muted">
                <span className="shrink-0">환율 1달러 =</span>
                <input
                  inputMode="decimal"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  onBlur={() => { void saveRate() }}
                  placeholder="입력하면 USD도 원화 합계에 포함"
                  aria-label="USD 환율 (원)"
                  className="flex-1 min-w-0 bg-raised rounded-lg px-2.5 py-1.5 text-fg num focus:outline-none"
                />
                <span className="shrink-0">원</span>
              </label>
            )}
            {annualKrw > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-[11px] text-muted">연간 합계</span>
                <span className="text-sm font-bold text-warning num">{fmt(annualKrw)}원</span>
              </div>
            )}
            {subscriptions.length > 1 && (() => {
              const catMap: Record<string, number> = {}
              subscriptions.forEach(s => {
                const monthly = getMonthlyKrw(s, usdKrwRate)
                if (monthly !== null) catMap[s.category] = (catMap[s.category] || 0) + monthly
              })
              const total = Object.values(catMap).reduce((a, b) => a + b, 0)
              if (!total) return null
              const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1])
              const BAR_COLORS = ['#3D8EF8', '#F25260', '#2ACF6A', '#F5BE3A', '#9B7EFF', '#F06EC4']
              return (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-muted mb-2">카테고리 분포</p>
                  <div className="h-2 rounded-full overflow-hidden flex gap-px">
                    {entries.map(([cat], i) => (
                      <div key={cat} className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full" style={{ width: `${Math.round((catMap[cat] / total) * 100)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {entries.map(([cat], i) => (
                      <div key={cat} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                        <span className="text-[9px] text-muted">{cat}</span>
                        <span className="text-[9px] font-bold num text-muted">{Math.round((catMap[cat] / total) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* 구독 목록 */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((sub, subIdx) => {
            const color = sub.color ?? SERVICE_COLORS[0]
            const days = daysUntilBilling(sub)
            const catColor = CATEGORY_COLOR[sub.category]
            return (
              <div key={sub.id} className="bg-surface rounded-2xl px-4 py-3 list-item-enter" style={{ animationDelay: `${subIdx * 40}ms` }}>
                <div className="flex items-center gap-3">
                  {/* 이니셜 아이콘 */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                    style={{ backgroundColor: `${color}26` }}
                  >
                    <span style={{ color }}>{getInitial(sub.name)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{sub.name}</p>
                      {catColor && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ background: catColor.bg, color: catColor.text }}
                        >
                          {sub.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      {isYearly(sub) ? `매년 ${sub.billingMonth ?? 1}월 ${sub.billingDay}일` : `매월 ${sub.billingDay}일`}
                      {days === 0
                        ? <span className="text-expense ml-1 font-bold">· 오늘 결제</span>
                        : days <= 3
                          ? <span className="text-warning ml-1 font-semibold">· D-{days}</span>
                          : <span className="text-muted ml-1">· {days}일 후</span>
                      }
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white num">
                      {fmtPrice(sub.amount, sub.currency)}
                    </p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    {confirmingId === sub.id ? (
                      <>
                        <button onClick={() => setConfirmingId(null)} className="px-2 h-7 rounded-lg bg-raised text-muted text-[10px] font-bold">취소</button>
                        <button onClick={() => confirmDelete(sub.id)} className="px-2 h-7 rounded-lg bg-tone-red/20 text-expense text-[10px] font-bold">삭제</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(sub)}
                          aria-label={`${sub.name} 구독 수정`}
                          className="w-9 h-9 rounded-lg bg-raised flex items-center justify-center text-muted hover:text-white transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          aria-label={`${sub.name} 구독 삭제`}
                          className="w-9 h-9 rounded-lg bg-raised flex items-center justify-center text-muted hover:text-tone-red transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {sub.memo && (
                  <p className="text-[11px] text-muted mt-2 pl-13">{sub.memo}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 절감 시뮬레이터 */}
      {subscriptions.some(s => getMonthlyKrw(s, usdKrwRate) !== null) && (
        <div className="bg-surface rounded-2xl p-5">
          <p className="text-[15px] font-bold text-white mb-1">절감 시뮬레이터</p>
          <p className="text-[11px] text-muted mb-3">구독 취소 시 연간 절약액</p>
          <div className="space-y-2">
            {subscriptions
              .map(sub => ({ sub, monthly: getMonthlyKrw(sub, usdKrwRate) }))
              .filter((x): x is { sub: Subscription; monthly: number } => x.monthly !== null)
              .sort((a, b) => b.monthly - a.monthly)
              .slice(0, 3)
              .map(({ sub, monthly }) => {
                const color = sub.color ?? SERVICE_COLORS[0]
                const annual = monthly * 12
                return (
                  <div key={sub.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${color}26` }}>
                      <span style={{ color }}>{getInitial(sub.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{sub.name}</p>
                      <p className="text-[10px] text-muted">월 {fmt(monthly)}원</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-bold text-income num">+{fmt(annual)}원</p>
                      <p className="text-[9px] text-muted">연간 절약</p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* 추가/수정 바텀시트 */}
      {showSheet && (
        <InlineDialog
            onClose={() => setShowSheet(false)}
            label={editing ? '구독 수정' : '구독 추가'}
            containerClassName="fixed inset-0 z-50 bg-black/60 flex items-end justify-center modal-backdrop"
            panelClassName="relative bg-surface rounded-t-[28px] p-5 space-y-4 max-h-[85vh] overflow-y-auto w-full max-w-lg modal-panel"
        >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-bold text-white">{editing ? '구독 수정' : '구독 추가'}</p>
              <button onClick={() => setShowSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-raised text-muted">
                <X size={16} />
              </button>
            </div>

            {/* 색상 선택 */}
            <div className="flex gap-2">
              {SERVICE_COLORS.map((c, i) => (
                <button
                  key={c}
                  onClick={() => setColorIdx(i)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{ backgroundColor: c, transform: colorIdx === i ? 'scale(1.2)' : 'scale(1)', outline: colorIdx === i ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>

            {/* 서비스명 */}
            <div>
              <label className="text-[11px] text-muted font-semibold mb-1.5 block">서비스명</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 넷플릭스, 유튜브 프리미엄"
                className="w-full bg-raised rounded-xl px-3 py-2.5 text-sm text-white placeholder-tone-slate focus:outline-none"
              />
              {errors.name && <p className="text-[10px] text-expense mt-1">{errors.name}</p>}
            </div>

            {/* 금액 + 통화 */}
            <div>
              <label className="text-[11px] text-muted font-semibold mb-1.5 block">금액</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-raised rounded-xl px-3 py-2.5 text-sm text-white placeholder-tone-slate focus:outline-none num"
                />
                <div className="flex bg-raised rounded-xl overflow-hidden shrink-0">
                  {(['KRW', 'USD'] as const).map(cur => (
                    <button
                      key={cur}
                      onClick={() => setForm(f => ({ ...f, currency: cur }))}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${form.currency === cur ? 'bg-action text-on-action ' : 'text-muted'}`}
                    >
                      {cur === 'KRW' ? '원' : 'USD'}
                    </button>
                  ))}
                </div>
              </div>
              {errors.amount && <p className="text-[10px] text-expense mt-1">{errors.amount}</p>}
            </div>

            {/* 결제일 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2" role="group" aria-label="결제 주기">
                {(['monthly', 'yearly'] as const).map(c => (
                  <button key={c} type="button" aria-pressed={(form.cycle ?? 'monthly') === c}
                    onClick={() => setForm(f => ({ ...f, cycle: c, billingMonth: c === 'yearly' ? (f.billingMonth ?? new Date().getMonth() + 1) : undefined }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${(form.cycle ?? 'monthly') === c ? 'bg-action text-on-action' : 'bg-raised text-muted'}`}>
                    {c === 'monthly' ? '매월' : '매년'}
                  </button>
                ))}
              </div>
              {form.cycle === 'yearly' && (
                <label className="flex items-center gap-2 mb-2 text-[11px] text-muted font-semibold">
                  결제 월
                  <select value={form.billingMonth ?? 1} onChange={e => setForm(f => ({ ...f, billingMonth: Number(e.target.value) }))}
                    className="bg-raised rounded-xl px-3 py-2 text-sm text-fg focus:outline-none">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </label>
              )}
              <label className="text-[11px] text-muted font-semibold mb-1.5 block">결제일</label>
              <div className="flex flex-wrap gap-1.5">
                {[1,5,10,14,15,20,25,28,31].map(d => (
                  <button
                    key={d}
                    onClick={() => setForm(f => ({ ...f, billingDay: d }))}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${form.billingDay === d ? 'bg-action text-on-action ' : 'bg-raised text-muted'}`}
                  >
                    {d}일
                  </button>
                ))}
              </div>
              {/* 직접 입력 */}
              <input
                type="number"
                min={1}
                max={31}
                value={form.billingDay}
                onChange={e => setForm(f => ({ ...f, billingDay: Math.min(31, Math.max(1, Number(e.target.value))) }))}
                onFocus={e => e.target.select()}
                className="mt-2 w-full bg-raised rounded-xl px-3 py-2 text-sm text-white focus:outline-none num"
                placeholder="직접 입력 (1-31)"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="text-[11px] text-muted font-semibold mb-1.5 block">카테고리</label>
              <div className="flex flex-wrap gap-1.5">
                {EXPENSE_CATEGORIES.map(cat => {
                  const c = CATEGORY_COLOR[cat]
                  const active = form.category === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                      style={active && c
                        ? { background: c.bg, color: c.text }
                        : { background: '#252A3F', color: '#4E5968' }
                      }
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="text-[11px] text-muted font-semibold mb-1.5 block">메모 (선택)</label>
              <input
                type="text"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="예: 가족 공유, 연간 결제"
                className="w-full bg-raised rounded-xl px-3 py-2.5 text-sm text-white placeholder-tone-slate focus:outline-none"
              />
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              className="w-full py-3 bg-action text-on-action font-bold rounded-2xl flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {editing ? '수정 완료' : '추가하기'}
            </button>
        </InlineDialog>
      )}
    </div>
  )
}
