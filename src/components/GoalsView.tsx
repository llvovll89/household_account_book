import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Check, Minus } from 'lucide-react'
import type { SavingsGoal } from '../types'
import { fmt } from '../lib/format'
import { generateId } from '../lib/format'

interface Props {
  goals: SavingsGoal[]
  addTrigger?: number
  onChange: (items: SavingsGoal[]) => void
}

const PRESET_EMOJIS = ['🏖️', '🏠', '🚗', '✈️', '💍', '🎓', '💻', '📱', '🏋️', '🌏', '💰', '🎯']
const PRESET_COLORS = [
  '#3D8EF8', '#2ACF6A', '#F5BE3A', '#F25260',
  '#9B7EFF', '#F06EC4', '#00D4FF', '#FFA02E',
]

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const EMPTY = {
  name: '',
  targetAmount: 0,
  currentAmount: 0,
  emoji: '🎯',
  color: PRESET_COLORS[0],
  deadline: '',
  memo: '',
}

export default function GoalsView({ goals, addTrigger, onChange }: Props) {
  const [showSheet, setShowSheet] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [targetStr, setTargetStr] = useState('')
  const [currentStr, setCurrentStr] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 저금/인출 시트
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null)
  const [depositMode, setDepositMode] = useState<'add' | 'sub'>('add')
  const [depositStr, setDepositStr] = useState('')

  useEffect(() => {
    if (addTrigger && addTrigger > 0) openAdd()
  }, [addTrigger])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY, color: PRESET_COLORS[goals.length % PRESET_COLORS.length] })
    setTargetStr('')
    setCurrentStr('')
    setErrors({})
    setShowSheet(true)
  }

  function openEdit(g: SavingsGoal) {
    setEditing(g)
    setForm({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      emoji: g.emoji,
      color: g.color,
      deadline: g.deadline ?? '',
      memo: g.memo,
    })
    setTargetStr(g.targetAmount > 0 ? String(g.targetAmount) : '')
    setCurrentStr(g.currentAmount > 0 ? String(g.currentAmount) : '')
    setErrors({})
    setShowSheet(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '목표명을 입력해주세요'
    if (!targetStr || Number(targetStr) <= 0) e.target = '목표 금액을 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const target = Number(targetStr)
    const current = Math.min(Number(currentStr) || 0, target)
    if (editing) {
      onChange(goals.map(g =>
        g.id === editing.id
          ? { ...g, ...form, targetAmount: target, currentAmount: current, deadline: form.deadline || undefined }
          : g
      ))
    } else {
      onChange([...goals, {
        id: generateId(),
        ...form,
        targetAmount: target,
        currentAmount: current,
        deadline: form.deadline || undefined,
        createdAt: Date.now(),
      }])
    }
    setShowSheet(false)
  }

  function handleDelete(id: string) {
    if (!confirm('이 목표를 삭제할까요?')) return
    onChange(goals.filter(g => g.id !== id))
  }

  function handleDeposit() {
    if (!depositGoal || !depositStr) return
    const amount = Number(depositStr)
    if (!amount || amount <= 0) return
    onChange(goals.map(g => {
      if (g.id !== depositGoal.id) return g
      const next = depositMode === 'add'
        ? Math.min(g.currentAmount + amount, g.targetAmount)
        : Math.max(g.currentAmount - amount, 0)
      return { ...g, currentAmount: next }
    }))
    setDepositGoal(null)
    setDepositStr('')
  }

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0)
  const doneCount = goals.filter(g => g.currentAmount >= g.targetAmount).length

  return (
    <div className="space-y-3 tab-content">
      {/* 요약 카드 */}
      <div className="bg-[#1C1C1E] rounded-2xl p-5">
        <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide mb-2">저축 목표 현황</p>
        {goals.length === 0 ? (
          <p className="text-[#8B95A1] text-sm">목표를 추가해 저축을 시작해보세요</p>
        ) : (
          <>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-white num">{fmt(totalCurrent)}<span className="text-sm text-[#8B95A1] ml-1">원</span></p>
                <p className="text-[11px] text-[#4E5968] mt-0.5">목표 {fmt(totalTarget)}원 중</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold num" style={{ color: PRESET_COLORS[0] }}>
                  {totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%
                </p>
                <p className="text-[11px] text-[#4E5968]">{doneCount}/{goals.length} 완료</p>
              </div>
            </div>
            {/* 전체 진행률 바 */}
            <div className="h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0}%`,
                  background: 'linear-gradient(90deg, #3D8EF8, #2ACF6A)',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* 목표 목록 */}
      {goals.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-bold text-white text-[15px]">저축 목표가 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">여행, 비상금, 내 집 마련 등 목표를 세워보세요</p>
          <button onClick={openAdd} className="mt-4 px-5 py-2 bg-[#3D8EF8] text-white text-sm font-bold rounded-xl">
            목표 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0
            const done = pct >= 100
            const days = g.deadline ? daysUntil(g.deadline) : null

            return (
              <div key={g.id} className="bg-[#1C1C1E] rounded-2xl p-4">
                {/* 헤더 */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: `${g.color}20` }}
                  >
                    {g.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{g.name}</p>
                      {done && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#2ACF6A]/15 text-[#2ACF6A] shrink-0">완료 🎉</span>
                      )}
                    </div>
                    {days !== null && (
                      <p className={`text-[11px] mt-0.5 ${days < 0 ? 'text-[#F25260]' : days <= 7 ? 'text-[#F5BE3A]' : 'text-[#4E5968]'}`}>
                        {days < 0 ? `${Math.abs(days)}일 초과` : days === 0 ? '오늘 목표일' : `D-${days}`}
                      </p>
                    )}
                    {g.memo && <p className="text-[10px] text-[#4E5968] mt-0.5 truncate">{g.memo}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(g)} className="w-7 h-7 rounded-lg bg-[#2C2C2E] flex items-center justify-center text-[#8B95A1] hover:text-white transition-colors">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="w-7 h-7 rounded-lg bg-[#2C2C2E] flex items-center justify-center text-[#8B95A1] hover:text-[#F25260] transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* 진행률 바 */}
                <div className="h-2.5 bg-[#2C2C2E] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: done ? '#2ACF6A' : g.color }}
                  />
                </div>

                {/* 금액 + 저금 버튼 */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold num" style={{ color: done ? '#2ACF6A' : g.color }}>{fmt(g.currentAmount)}</span>
                    <span className="text-[11px] text-[#4E5968]"> / {fmt(g.targetAmount)}원</span>
                    <span className="text-[11px] text-[#8B95A1] ml-2">({Math.round(pct)}%)</span>
                  </div>
                  {!done && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setDepositGoal(g); setDepositMode('sub'); setDepositStr('') }}
                        className="w-8 h-8 rounded-xl bg-[#2C2C2E] flex items-center justify-center text-[#8B95A1] hover:text-white transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                      <button
                        onClick={() => { setDepositGoal(g); setDepositMode('add'); setDepositStr('') }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold transition-colors"
                        style={{ backgroundColor: g.color }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 저금/인출 시트 */}
      {depositGoal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
          onClick={(e) => e.target === e.currentTarget && setDepositGoal(null)}
        >
          <div className="relative bg-[#1A1E30] rounded-t-[28px] p-5 space-y-4 w-full max-w-lg">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-white">{depositGoal.emoji} {depositGoal.name}</p>
              <button onClick={() => setDepositGoal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#8B95A1]">
                <X size={16} />
              </button>
            </div>
            <div className="flex bg-[#2C2C2E] rounded-xl overflow-hidden">
              {(['add', 'sub'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setDepositMode(m)}
                  className={`flex-1 py-2.5 text-sm font-bold transition-colors ${depositMode === m ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968]'}`}
                >
                  {m === 'add' ? '💰 저금' : '💸 인출'}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1] mb-1.5">
                현재 <span className="text-white font-bold">{fmt(depositGoal.currentAmount)}원</span>
                {' / '}목표 <span className="text-white font-bold">{fmt(depositGoal.targetAmount)}원</span>
              </p>
              <input
                type="number"
                inputMode="numeric"
                value={depositStr}
                onChange={e => setDepositStr(e.target.value)}
                placeholder="금액 입력"
                className="w-full bg-[#2C2C2E] rounded-xl px-3 py-3 text-lg font-bold text-white placeholder-[#4E5968] focus:outline-none num"
                autoFocus
              />
            </div>
            <button
              onClick={handleDeposit}
              className="w-full py-3 bg-[#3D8EF8] text-white font-bold rounded-2xl flex items-center justify-center gap-2"
            >
              <Check size={16} />확인
            </button>
          </div>
        </div>
      )}

      {/* 추가/수정 바텀시트 */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
          onClick={(e) => e.target === e.currentTarget && setShowSheet(false)}
        >
          <div className="relative bg-[#1A1E30] rounded-t-[28px] p-5 space-y-4 max-h-[90vh] overflow-y-auto w-full max-w-lg">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-white">{editing ? '목표 수정' : '목표 추가'}</p>
              <button onClick={() => setShowSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#8B95A1]">
                <X size={16} />
              </button>
            </div>

            {/* 이모지 선택 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">아이콘</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`w-10 h-10 rounded-xl text-xl transition-all ${form.emoji === e ? 'bg-[#3D8EF8]/20 ring-2 ring-[#3D8EF8]' : 'bg-[#2C2C2E]'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* 색상 선택 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">색상</label>
              <div className="flex gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                      outline: form.color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 목표명 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">목표명</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 제주도 여행, 비상금 500만원"
                className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none"
              />
              {errors.name && <p className="text-[10px] text-[#F25260] mt-1">{errors.name}</p>}
            </div>

            {/* 목표 금액 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">목표 금액</label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={targetStr}
                  onChange={e => setTargetStr(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 pr-8 text-sm text-white placeholder-[#4E5968] focus:outline-none num"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4E5968] text-sm">원</span>
              </div>
              {errors.target && <p className="text-[10px] text-[#F25260] mt-1">{errors.target}</p>}
            </div>

            {/* 현재 저축액 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">현재 저축액 <span className="text-[#4E5968]">(선택)</span></label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentStr}
                  onChange={e => setCurrentStr(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 pr-8 text-sm text-white placeholder-[#4E5968] focus:outline-none num"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4E5968] text-sm">원</span>
              </div>
            </div>

            {/* 목표 기한 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">목표 기한 <span className="text-[#4E5968]">(선택)</span></label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="text-[11px] text-[#8B95A1] font-semibold mb-1.5 block">메모 <span className="text-[#4E5968]">(선택)</span></label>
              <input
                type="text"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="예: 내년 여름 목표"
                className="w-full bg-[#2C2C2E] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full py-3 bg-[#3D8EF8] text-white font-bold rounded-2xl flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {editing ? '수정 완료' : '목표 만들기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
