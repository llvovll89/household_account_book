import { useState, useMemo } from 'react'
import { X, Pencil, Trash2, Check } from 'lucide-react'
import { useModalClose } from '../hooks/useModalClose'
import type { Transaction } from '../types'
import { fmt } from '../lib/format'

interface TagStat {
  name: string
  count: number
  totalExpense: number
  totalIncome: number
}

interface Props {
  transactions: Transaction[]
  onRenameTag: (oldName: string, newName: string) => void
  onDeleteTag: (name: string) => void
  onClose: () => void
}

export default function TagManagerModal({ transactions, onRenameTag, onDeleteTag, onClose }: Props) {
  const { closing, handleClose } = useModalClose(onClose)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const tags = useMemo<TagStat[]>(() => {
    const map = new Map<string, TagStat>()
    for (const t of transactions) {
      for (const tag of t.tags ?? []) {
        const stat = map.get(tag) ?? { name: tag, count: 0, totalExpense: 0, totalIncome: 0 }
        stat.count++
        if (t.type === 'expense') stat.totalExpense += t.amount
        else stat.totalIncome += t.amount
        map.set(tag, stat)
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [transactions])

  function startEdit(tag: string) {
    setEditingTag(tag)
    setEditValue(tag)
  }

  function confirmRename(oldName: string) {
    const newName = editValue.trim()
    if (newName && newName !== oldName) {
      onRenameTag(oldName, newName)
    }
    setEditingTag(null)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] px-5 pt-5 pb-8 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold text-white">태그 관리</h2>
            <p className="text-[12px] text-[#8B95A1] mt-0.5">태그 이름 변경 또는 삭제</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E]">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {tags.length === 0 ? (
            <div className="text-center text-[#4E5968] text-[13px] py-12">
              사용된 태그가 없습니다<br />내역 설명에 #태그 형식으로 추가해보세요
            </div>
          ) : (
            tags.map((tag) => (
              <div key={tag.name} className="bg-[#2C2C2E] rounded-xl px-4 py-3 flex items-center gap-3">
                {editingTag === tag.name ? (
                  <>
                    <span className="text-[#3D8EF8] text-[14px] font-bold">#</span>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename(tag.name)
                        if (e.key === 'Escape') setEditingTag(null)
                      }}
                      className="flex-1 bg-[#1C1C1E] rounded-lg px-2 py-1 text-[14px] text-white focus:outline-none"
                    />
                    <button onClick={() => confirmRename(tag.name)} className="text-[#2ACF6A]">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setEditingTag(null)} className="text-[#4E5968]">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#3D8EF8] text-[14px] font-bold">#</span>
                        <span className="text-[14px] font-semibold text-white truncate">{tag.name}</span>
                        <span className="text-[11px] text-[#4E5968]">{tag.count}건</span>
                      </div>
                      <div className="flex gap-3 mt-0.5 text-[11px]">
                        {tag.totalExpense > 0 && (
                          <span className="text-[#F25260]">-{fmt(tag.totalExpense)}원</span>
                        )}
                        {tag.totalIncome > 0 && (
                          <span className="text-[#2ACF6A]">+{fmt(tag.totalIncome)}원</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(tag.name)}
                      className="text-[#8B95A1] hover:text-white transition-colors p-1"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDeleteTag(tag.name)}
                      className="text-[#4E5968] hover:text-[#F25260] transition-colors p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
