import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../types'
import type { TransactionType } from '../types'
import { useModalClose } from '../hooks/useModalClose'
import { categoryUsageCounts, projectCategoryUsage } from '../lib/categoryMigration'
import type { CategoryMoves, CategoryUsage } from '../lib/categoryMigration'

interface Props {
  customExpenseCategories: string[]
  customIncomeCategories: string[]
  usage?: CategoryUsage
  onSave: (expense: string[], income: string[], moves: CategoryMoves) => void
  onClose: () => void
}
const EMPTY_USAGE: CategoryUsage = { transactions: [], recurring: [], templates: [], rules: [], budgets: [], subscriptions: [], goals: [] }

export default function CategoryModal({ customExpenseCategories, customIncomeCategories, usage = EMPTY_USAGE, onSave, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const [tab, setTab] = useState<TransactionType>('expense')
  const [expense, setExpense] = useState(customExpenseCategories)
  const [income, setIncome] = useState(customIncomeCategories)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [moves, setMoves] = useState<CategoryMoves>({ expense: {}, income: {} })
  const [deleting, setDeleting] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const base = tab === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  const custom = (tab === 'expense' ? expense : income).filter(c => !base.includes(c))
  const setCustom = tab === 'expense' ? setExpense : setIncome
  const targets = [...new Set([...base, ...custom])].filter(c => c !== deleting && !moves[tab][c])
  const counts = deleting ? categoryUsageCounts(projectCategoryUsage(usage, moves), deleting, tab) : null

  function add() {
    const name = input.trim()
    if (!name) { setError('카테고리 이름을 입력하세요.'); return }
    if ([...base, ...custom].includes(name) || moves[tab][name]) { setError('이미 사용 중이거나 삭제 대기 중인 이름이에요.'); return }
    setCustom(prev => [...prev, name]); setInput(''); setError('')
  }
  function confirmDelete() {
    if (!deleting || !targets.includes(destination)) return
    const name = deleting
    setMoves(prev => ({ ...prev, [tab]: Object.fromEntries([...Object.entries(prev[tab]).map(([from, to]) => [from, to === name ? destination : to]), [name, destination]]) }))
    setCustom(prev => prev.filter(c => c !== name)); setDeleting(null)
  }
  return <div className="fixed inset-0 flex items-end justify-center z-50 modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="category-modal-title" onClick={e => e.target === e.currentTarget && handleClose()}>
    <div ref={modalRef} className="category-management modal-panel w-full max-w-lg max-h-[90dvh] flex flex-col" {...(closing ? { 'data-closing': '' } : {})}>
      <header role="presentation" className="flex items-center justify-between p-6 shrink-0">
        <div><h2 id="category-modal-title" className="text-lg font-bold">카테고리 관리</h2><p className="text-xs text-[#8B95A1] mt-1">분류를 추가하고 기존 내역을 옮길 수 있어요.</p></div>
        <button aria-label="카테고리 관리 닫기" onClick={handleClose} className="dialog-icon-button"><X size={18} /></button>
      </header>
      <div className="px-6 flex gap-2 mb-4" role="group" aria-label="카테고리 유형">
        {(['expense', 'income'] as const).map(type => <button key={type} aria-pressed={tab === type} className="category-tab" onClick={() => { setTab(type); setDeleting(null); setInput(''); setError('') }}>{type === 'expense' ? '지출 카테고리' : '수입 카테고리'}</button>)}
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-5 space-y-5">
        <section><h3 className="text-xs text-[#8B95A1] mb-2">기본 카테고리</h3><div className="category-chips">{base.map(c => <span key={c}>{c}</span>)}</div></section>
        <section><h3 className="text-xs text-[#8B95A1] mb-2">추가 카테고리</h3>
          {custom.length === 0 ? <p className="text-sm text-[#8B95A1]">아래에서 새 카테고리를 추가하세요.</p> : <div className="category-chips">{custom.map(c => <span key={c}>{c}<button aria-label={`${c} 카테고리 삭제`} onClick={() => { setDeleting(c); setDestination(tab === 'expense' ? '기타지출' : '기타수입') }}><Trash2 size={15} /></button></span>)}</div>}
        </section>
        {deleting && <section className="category-delete-preview" aria-labelledby="delete-category-title">
          <h3 id="delete-category-title" className="text-sm font-bold">{deleting} 삭제 전 확인</h3>
          <dl className="category-usage-grid">{Object.entries(counts!).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}건</dd></div>)}</dl>
          <p className="text-xs text-[#8B95A1] mt-2">연결된 내역은 선택한 카테고리로 옮겨요. 같은 월의 예산은 한도가 합쳐지고 목표 연결도 바뀌어요.</p>
          <label htmlFor="category-destination" className="text-xs block mt-3 mb-2">이동할 카테고리</label>
          <select id="category-destination" className="w-full p-3" value={destination} onChange={e => setDestination(e.target.value)}>{targets.map(c => <option key={c}>{c}</option>)}</select>
          <div className="flex gap-2 mt-3"><button className="secondary-action flex-1" onClick={() => setDeleting(null)}>삭제 취소</button><button className="primary-action flex-1" onClick={confirmDelete}>이동 후 삭제</button></div>
          <p className="text-xs text-[#8B95A1] mt-2">아래 저장 버튼을 누르면 적용돼요.</p>
        </section>}
        {Object.values(moves).some(values => Object.keys(values).length > 0) && <div className="text-xs text-[#8B95A1]" role="status">{(['expense', 'income'] as const).flatMap(type => Object.entries(moves[type]).map(([from, to]) => <p key={`${type}:${from}`}>{from} → {to} 이동 예정</p>))}<p className="mt-1">저장하지 않고 닫으면 변경을 취소해요.</p></div>}
        <div><label htmlFor="new-category-name" className="text-xs block mb-2">새 카테고리 이름</label><div className="flex gap-2">
          <input id="new-category-name" value={input} aria-invalid={!!error} aria-describedby="category-name-help category-name-error" onChange={e => { setInput(e.target.value); setError('') }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add() } }} className="min-w-0 flex-1 p-3" />
          <button aria-label="카테고리 추가" className="primary-action" onClick={add}><Plus size={18} /></button>
        </div><p id="category-name-help" className="text-xs text-[#8B95A1] mt-2">기본 카테고리는 삭제할 수 없어요.</p><p id="category-name-error" role={error ? 'alert' : undefined} className="text-xs text-[#F25260] mt-2">{error}</p></div>
      </div>
      <footer role="presentation" className="dialog-footer"><button disabled={!!deleting} className="primary-action w-full" onClick={() => { onSave(expense, income, moves); handleClose() }}>저장</button></footer>
    </div>
  </div>
}
