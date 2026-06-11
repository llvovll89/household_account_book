import { useState, useEffect, useRef } from 'react'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import type { Subscription } from '../types'
import { EXPENSE_CATEGORIES, CATEGORY_COLOR } from '../types'
import { fmt } from '../lib/format'
import { generateId } from '../lib/format'

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

function daysUntilBilling(billingDay: number): number {
  const today = new Date()
  const day = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  if (billingDay >= day) return billingDay - day
  // 이번 달 이미 지남 → 다음 달
  return daysInMonth - day + billingDay
}

const EMPTY: Omit<Subscription, 'id' | 'createdAt'> = {
  name: '',
  amount: 0,
  currency: 'KRW',
  billingDay: 1,
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
  const mountedTriggerRef = useRef(addTrigger)

  // FAB 트리거 — 마운트 시점 이후 변경됐을 때만 열기
  useEffect(() => {
    if (addTrigger && addTrigger > 0 && addTrigger !== mountedTriggerRef.current) openAdd()
    mountedTriggerRef.current = addTrigger
  }, [addTrigger])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY })
    setAmountStr('')
    setColorIdx(subscriptions.length % SERVICE_COLORS.length)
    setErrors({})
    setShowSheet(true)
  }

  function openEdit(sub: Subscription) {
    setEditing(sub)
    setForm({
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency,
      billingDay: sub.billingDay,
      category: sub.category,
      memo: sub.memo,
    })
    setAmountStr(sub.amount > 0 ? String(sub.amount) : '')
    const idx = SERVICE_COLORS.indexOf((sub as any).color ?? SERVICE_COLORS[0])
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

    if (editing) {
      onChange(subscriptions.map(s =>
        s.id === editing.id ? { ...s, ...form, amount, color } : s
      ))
    } else {
      const next: Subscription = {
        id: generateId(),
        ...form,
        amount,
        createdAt: Date.now(),
        ...({ color } as any),
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
  const totalKrw = subscriptions
    .filter(s => s.currency === 'KRW')
    .reduce((sum, s) => sum + s.amount, 0)
  const totalUsd = subscriptions
    .filter(s => s.currency === 'USD')
    .reduce((sum, s) => sum + s.amount, 0)
  const annualKrw = totalKrw * 12

  return (
    <div className="space-y-3 tab-content">
      {/* 월 합계 카드 */}
      <div className="bg-[#1C1C1E] rounded-2xl p-5">
        <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide mb-1">월 구독 비용</p>
        {subscriptions.length === 0 ? (
          <p className="text-[#8B95A1] text-sm">구독 서비스를 추가해보세요</p>
        ) : (
          <>
            <div className="flex items-end gap-3 flex-wrap mb-3">
              {totalKrw > 0 && (
                <p className="text-2xl font-bold text-white num">{fmt(totalKrw)}<span className="text-sm ml-1 text-[#8B95A1]">원</span></p>
              )}
              {totalUsd > 0 && (
                <p className="text-2xl font-bold text-white num">${totalUsd.toFixed(2)}</p>
              )}
              <p className="text-[11px] text-[#4E5968] mb-1">{subscriptions.length}개 서비스</p>
            </div>
            {annualKrw > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-[11px] text-[#4E5968]">연간 합계</span>
                <span className="text-sm font-bold text-[#F5BE3A] num">{fmt(annualKrw)}원</span>
              </div>
            )}
            {subscriptions.filter(s => s.currency === 'KRW').length > 1 && (() => {
              const catMap: Record<string, number> = {}
              subscriptions.filter(s => s.currency === 'KRW').forEach(s => {
                catMap[s.category] = (catMap[s.category] || 0) + s.amount
              })
              const total = Object.values(catMap).reduce((a, b) => a + b, 0)
              if (!total) return null
              const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1])
              const BAR_COLORS = ['#3D8EF8', '#F25260', '#2ACF6A', '#F5BE3A', '#9B7EFF', '#F06EC4']
              return (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-[#4E5968] mb-2">카테고리 분포</p>
                  <div className="h-2 rounded-full overflow-hidden flex gap-px">
                    {entries.map(([cat], i) => (
                      <div key={cat} className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full" style={{ width: `${Math.round((catMap[cat] / total) * 100)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {entries.map(([cat], i) => (
                      <div key={cat} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                        <span className="text-[9px] text-[#8B95A1]">{cat}</span>
                        <span className="text-[9px] font-bold num text-[#4E5968]">{Math.round((catMap[cat] / total) * 100)}%</span>
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
      {sorted.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-bold text-white text-[15px]">구독 서비스가 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">넷플릭스, 유튜브 프리미엄 등을 추가해보세요</p>
          <button
            onClick={openAdd}
            className="mt-4 px-5 py-2 bg-[#3D8EF8] text-white text-sm font-bold rounded-xl"
          >
            추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((sub, subIdx) => {
            const color = (sub as any).color ?? SERVICE_COLORS[0]
            const days = daysUntilBilling(sub.billingDay)
            const catColor = CATEGORY_COLOR[sub.category]
            return (
              <div key={sub.id} className="bg-[#1C1C1E] rounded-2xl px-4 py-3 list-item-enter" style={{ animationDelay: `${subIdx * 40}ms` }}>
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
                    <p className="text-[11px] text-[#4E5968] mt-0.5">
                      매월 {sub.billingDay}일
                      {days === 0
                        ? <span className="text-[#F25260] ml-1 font-bold">· 오늘 결제</span>
                        : days <= 3
                          ? <span className="text-[#F5BE3A] ml-1 font-semibold">· D-{days}</span>
                          : <span className="text-[#8B95A1] ml-1">· {days}일 후</span>
                      }
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white num">
                      {sub.currency === 'USD' ? `$${sub.amount.toFixed(2)}` : `${fmt(sub.amount)}원`}
                    </p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    {confirmingId === sub.id ? (
                      <>
                        <button onClick={() => setConfirmingId(null)} className="px-2 h-7 rounded-lg bg-[#2C2C2E] text-[#8B95A1] text-[10px] font-bold">취소</button>
                        <button onClick={() => confirmDelete(sub.id)} className="px-2 h-7 rounded-lg bg-[#F25260]/20 text-[#F25260] text-[10px] font-bold">삭제</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(sub)}
                          aria-label={`${sub.name} 구독 수정`}
                          className="w-7 h-7 rounded-lg bg-[#2C2C2E] flex items-center justify-center text-[#8B95A1] hover:text-white transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          aria-label={`${sub.name} 구독 삭제`}
                          className="w-7 h-7 rounded-lg bg-[#2C2C2E] flex items-center justify-center text-[#8B95A1] hover:text-[#F25260] transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {sub.memo && (
                  <p className="text-[11px] text-[#4E5968] mt-2 pl-13">{sub.memo}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 절감 시뮬레이터 */}
      {subscriptions.filter(s => s.currency === 'KRW').length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl p-5">
          <p className="text-[15px] font-bold text-white mb-1">절감 시뮬레이터</p>
          <p className="text-[11px] text-[#4E5968] mb-3">구독 취소 시 연간 절약액</p>
          <div className="space-y-2">
            {[...subscriptions]
              .filter(s => s.currency === 'KRW')
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 3)
              .map(sub => {
                const color = (sub as any).color ?? SERVICE_COLORS[0]
                const annual = sub.amount * 12
                return (
                  <div key={sub.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${color}26` }}>
                      <span style={{ color }}>{getInitial(sub.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{sub.name}</p>
                      <p className="text-[10px] text-[#4E5968]">월 {fmt(sub.amount)}원</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-bold text-[#2ACF6A] num">+{fmt(annual)}원</p>
                      <p className="text-[9px] text-[#4E5968]">연간 절약</p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* 추가/수정 바텀시트 */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowSheet(false)}
        >
          <div className="relative bg-[#1A1E30] rounded-t-[28px] p-5 space-y-4 max-h-[85vh] overflow-y-auto w-full max-w-lg modal-panel">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-bold text-white">{editing ? '구독 수정' : '구독 추가'}</p>
              <button onClick={() => setShowSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#8B95A1]">
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
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">서비스명</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 넷플릭스, 유튜브 프리미엄"
                className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none"
              />
              {errors.name && <p className="text-[10px] text-[#F25260] mt-1">{errors.name}</p>}
            </div>

            {/* 금액 + 통화 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">금액</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-[#2C2C2E] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none num"
                />
                <div className="flex bg-[#2C2C2E] rounded-xl overflow-hidden shrink-0">
                  {(['KRW', 'USD'] as const).map(cur => (
                    <button
                      key={cur}
                      onClick={() => setForm(f => ({ ...f, currency: cur }))}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${form.currency === cur ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968]'}`}
                    >
                      {cur === 'KRW' ? '원' : 'USD'}
                    </button>
                  ))}
                </div>
              </div>
              {errors.amount && <p className="text-[10px] text-[#F25260] mt-1">{errors.amount}</p>}
            </div>

            {/* 결제일 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">매월 결제일</label>
              <div className="flex flex-wrap gap-1.5">
                {[1,5,10,14,15,20,25,28,31].map(d => (
                  <button
                    key={d}
                    onClick={() => setForm(f => ({ ...f, billingDay: d }))}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${form.billingDay === d ? 'bg-[#3D8EF8] text-white' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}
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
                className="mt-2 w-full bg-[#2C2C2E] rounded-xl px-3 py-2 text-sm text-white focus:outline-none num"
                placeholder="직접 입력 (1-31)"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">카테고리</label>
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
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">메모 (선택)</label>
              <input
                type="text"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="예: 가족 공유, 연간 결제"
                className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none"
              />
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              className="w-full py-3 bg-[#3D8EF8] text-white font-bold rounded-2xl flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {editing ? '수정 완료' : '추가하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
