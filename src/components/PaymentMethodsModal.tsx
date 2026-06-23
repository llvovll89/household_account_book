import { useState } from 'react'
import { X, Plus, Trash2, Pencil, Check } from 'lucide-react'
import type { UserPaymentMethod } from '../types'
import { generateId } from '../lib/format'

interface Props {
  userPaymentMethods: UserPaymentMethod[]
  onSave: (methods: UserPaymentMethod[]) => void
  onClose: () => void
}

type AddingType = 'check' | 'credit' | null

export default function PaymentMethodsModal({ userPaymentMethods, onSave, onClose }: Props) {
  const [methods, setMethods] = useState<UserPaymentMethod[]>(userPaymentMethods)
  const [addingType, setAddingType] = useState<AddingType>(null)
  const [addLabel, setAddLabel] = useState('')
  const [addBillingDay, setAddBillingDay] = useState('25')
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editBillingDay, setEditBillingDay] = useState('')
  const [editError, setEditError] = useState('')

  const cashMethod = methods.find((m) => m.type === 'cash') ?? { id: 'cash', type: 'cash' as const, label: '현금' }
  const checkMethods = methods.filter((m) => m.type === 'check')
  const creditMethods = methods.filter((m) => m.type === 'credit')

  function handleStartAdd(type: AddingType) {
    setAddingType(type)
    setAddLabel('')
    setAddBillingDay('25')
    setAddError('')
    setEditingId(null)
  }

  function handleAdd() {
    const label = addLabel.trim()
    if (!label) { setAddError('카드 이름을 입력하세요'); return }
    if (methods.some((m) => m.type === addingType && m.label === label)) {
      setAddError('같은 이름의 카드가 이미 있어요')
      return
    }
    if (addingType === 'credit') {
      const day = parseInt(addBillingDay, 10)
      if (isNaN(day) || day < 1 || day > 31) { setAddError('결제일은 1~31 사이여야 해요'); return }
      setMethods((prev) => [...prev, { id: generateId(), type: 'credit', label, billingDay: day }])
    } else {
      setMethods((prev) => [...prev, { id: generateId(), type: 'check', label }])
    }
    setAddingType(null)
    setAddLabel('')
    setAddError('')
  }

  function handleStartEdit(m: UserPaymentMethod) {
    setEditingId(m.id)
    setEditLabel(m.label)
    setEditBillingDay(String(m.billingDay ?? 25))
    setEditError('')
    setAddingType(null)
  }

  function handleSaveEdit(id: string, type: 'check' | 'credit') {
    const label = editLabel.trim()
    if (!label) { setEditError('카드 이름을 입력하세요'); return }
    if (methods.some((m) => m.id !== id && m.type === type && m.label === label)) {
      setEditError('같은 이름의 카드가 이미 있어요')
      return
    }
    if (type === 'credit') {
      const day = parseInt(editBillingDay, 10)
      if (isNaN(day) || day < 1 || day > 31) { setEditError('결제일은 1~31 사이여야 해요'); return }
      setMethods((prev) => prev.map((m) => m.id === id ? { ...m, label, billingDay: day } : m))
    } else {
      setMethods((prev) => prev.map((m) => m.id === id ? { ...m, label } : m))
    }
    setEditingId(null)
  }

  function handleDelete(id: string) {
    setMethods((prev) => prev.filter((m) => m.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function handleSave() {
    const hasCash = methods.some((m) => m.type === 'cash')
    const finalMethods = hasCash ? methods : [cashMethod, ...methods]
    onSave(finalMethods)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[88vh] flex flex-col border-t border-white/[0.06] modal-panel">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">결제수단 관리</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">사용하는 카드와 결제수단을 설정하세요</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4 min-h-0">
          {/* 현금 */}
          <section>
            <p className="text-[11px] font-bold text-[#4E5968] uppercase tracking-wide mb-2">현금</p>
            <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-base">💵</span>
              <span className="text-sm font-semibold text-white flex-1">{cashMethod.label}</span>
              <span className="text-[10px] font-semibold text-[#4E5968] bg-[#1C1C1E] px-2 py-0.5 rounded-full">기본</span>
            </div>
          </section>

          {/* 체크카드 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#4E5968] uppercase tracking-wide">체크카드</p>
              <button
                onClick={() => handleStartAdd(addingType === 'check' ? null : 'check')}
                className="flex items-center gap-1 text-[11px] font-bold text-[#3D8EF8] hover:text-[#5AA0FF] transition-colors"
              >
                <Plus size={12} />
                추가
              </button>
            </div>

            <div className="space-y-2">
              {checkMethods.map((m) => (
                editingId === m.id ? (
                  <div key={m.id} className="bg-[#2C2C2E] rounded-2xl px-4 py-3 space-y-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => { setEditLabel(e.target.value); setEditError('') }}
                      placeholder="카드 이름 (예: 카카오 체크)"
                      autoFocus
                      className="w-full bg-[#1C1C1E] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                    />
                    {editError && <p className="text-[11px] text-[#F25260] font-semibold">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(m.id, 'check')}
                        className="flex-1 py-2 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] text-xs font-bold"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="bg-[#2C2C2E] rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="text-base">💳</span>
                    <span className="text-sm font-semibold text-white flex-1">{m.label}</span>
                    <button onClick={() => handleStartEdit(m)} aria-label={`${m.label} 수정`} className="text-[#4E5968] hover:text-[#8B95A1] transition-colors p-1">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} aria-label={`${m.label} 삭제`} className="text-[#4E5968] hover:text-[#F25260] transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              ))}

              {checkMethods.length === 0 && addingType !== 'check' && (
                <p className="text-[12px] text-[#4E5968] text-center py-2">체크카드를 추가해보세요</p>
              )}

              {addingType === 'check' && (
                <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3 space-y-2">
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => { setAddLabel(e.target.value); setAddError('') }}
                    placeholder="카드 이름 (예: 카카오 체크)"
                    autoFocus
                    className="w-full bg-[#1C1C1E] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                  />
                  {addError && <p className="text-[11px] text-[#F25260] font-semibold">{addError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleAdd} className="flex-1 py-2 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold">
                      추가
                    </button>
                    <button onClick={() => setAddingType(null)} className="px-4 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] text-xs font-bold">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 신용카드 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#4E5968] uppercase tracking-wide">신용카드</p>
              <button
                onClick={() => handleStartAdd(addingType === 'credit' ? null : 'credit')}
                className="flex items-center gap-1 text-[11px] font-bold text-[#3D8EF8] hover:text-[#5AA0FF] transition-colors"
              >
                <Plus size={12} />
                추가
              </button>
            </div>

            <div className="space-y-2">
              {creditMethods.map((m) => (
                editingId === m.id ? (
                  <div key={m.id} className="bg-[#2C2C2E] rounded-2xl px-4 py-3 space-y-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => { setEditLabel(e.target.value); setEditError('') }}
                      placeholder="카드 이름 (예: 삼성카드)"
                      autoFocus
                      className="w-full bg-[#1C1C1E] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8B95A1] font-semibold shrink-0">결제일</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editBillingDay}
                        onChange={(e) => { setEditBillingDay(e.target.value); setEditError('') }}
                        onFocus={e => e.target.select()}
                        className="w-16 bg-[#1C1C1E] text-white text-center rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                      />
                      <span className="text-xs text-[#8B95A1]">일</span>
                    </div>
                    {editError && <p className="text-[11px] text-[#F25260] font-semibold">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(m.id, 'credit')}
                        className="flex-1 py-2 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] text-xs font-bold"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="bg-[#2C2C2E] rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="text-base">💎</span>
                    <span className="text-sm font-semibold text-white flex-1">{m.label}</span>
                    <span className="text-[11px] font-bold text-[#F5BE3A] bg-[#F5BE3A]/12 px-2 py-0.5 rounded-full">
                      매월 {m.billingDay ?? 25}일
                    </span>
                    <button onClick={() => handleStartEdit(m)} aria-label={`${m.label} 수정`} className="text-[#4E5968] hover:text-[#8B95A1] transition-colors p-1">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} aria-label={`${m.label} 삭제`} className="text-[#4E5968] hover:text-[#F25260] transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              ))}

              {creditMethods.length === 0 && addingType !== 'credit' && (
                <p className="text-[12px] text-[#4E5968] text-center py-2">신용카드를 추가해보세요</p>
              )}

              {addingType === 'credit' && (
                <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3 space-y-2">
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => { setAddLabel(e.target.value); setAddError('') }}
                    placeholder="카드 이름 (예: 삼성카드)"
                    autoFocus
                    className="w-full bg-[#1C1C1E] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8B95A1] font-semibold shrink-0">결제일</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={addBillingDay}
                      onChange={(e) => { setAddBillingDay(e.target.value); setAddError('') }}
                      onFocus={e => e.target.select()}
                      className="w-16 bg-[#1C1C1E] text-white text-center rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
                    />
                    <span className="text-xs text-[#8B95A1]">일</span>
                  </div>
                  {addError && <p className="text-[11px] text-[#F25260] font-semibold">{addError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleAdd} className="flex-1 py-2 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold">
                      추가
                    </button>
                    <button onClick={() => setAddingType(null)} className="px-4 py-2 rounded-xl bg-[#1C1C1E] text-[#8B95A1] text-xs font-bold">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="px-6 pb-safe-6 pt-4 shrink-0 border-t border-white/[0.06]">
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl bg-[#3D8EF8] text-white text-[15px] font-bold hover:bg-[#5AA0FF] active:scale-[0.98] transition-all"
          >
            <Check size={16} className="inline mr-1.5" />
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
