import { useState } from 'react'
import { Plus, Pin, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Memo } from '../types'

interface Props {
  memos: Memo[]
  onAdd: (title: string, content: string) => void
  onUpdate: (id: string, title: string, content: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  return isToday
    ? `오늘 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}

// 다크 파스텔 배경
const CARD_COLORS = [
  '#1A1F2E', '#1E1A2E', '#1A2420', '#21191A', '#1A1E2C', '#1E2018', '#1C1E28',
]

export default function MemoSection({ memos, onAdd, onUpdate, onDelete, onTogglePin }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const sorted = [...memos].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })

  function openNew() { setEditingId(null); setTitle(''); setContent(''); setShowForm(true) }
  function openEdit(m: Memo) { setEditingId(m.id); setTitle(m.title); setContent(m.content); setShowForm(true) }

  function handleSave() {
    if (!title.trim() && !content.trim()) return
    editingId ? onUpdate(editingId, title, content) : onAdd(title, content)
    setShowForm(false); setTitle(''); setContent(''); setEditingId(null)
  }

  function handleCancel() {
    setShowForm(false); setTitle(''); setContent(''); setEditingId(null)
  }

  return (
    <div className="space-y-3 tab-content">
      {/* 작성 폼 */}
      {showForm ? (
        <div className="bg-[#1E2236] rounded-3xl p-5">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="제목" autoFocus
            className="w-full text-[17px] font-bold text-white placeholder-[#2D3352] focus:outline-none mb-3 bg-transparent" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요..." rows={6}
            className="w-full text-[14px] text-[#8B95A1] placeholder-[#2D3352] focus:outline-none resize-none leading-relaxed bg-transparent" />
          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06] mt-2">
            <button onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#4E5968] bg-[#252A3F] hover:bg-[#2D3352] transition-colors">
              <X size={13} /> 취소
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#3D8EF8] hover:bg-[#5AA0FF] transition-colors">
              <Check size={13} /> 저장
            </button>
          </div>
        </div>
      ) : (
        <button onClick={openNew}
          className="w-full flex items-center gap-3 p-4 bg-[#1E2236] rounded-3xl hover:bg-[#252A3F] transition-colors group">
          <div className="w-10 h-10 rounded-2xl bg-[#3D8EF8]/15 flex items-center justify-center shrink-0 group-hover:bg-[#3D8EF8]/25 transition-colors">
            <Plus size={18} className="text-[#3D8EF8]" />
          </div>
          <span className="text-[14px] font-semibold text-[#4E5968] group-hover:text-[#8B95A1] transition-colors">새 메모 추가</span>
        </button>
      )}

      {sorted.length === 0 && !showForm && (
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">📝</p>
          <p className="font-bold text-white text-[15px]">메모가 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">예산 목표, 할 일 등을 기록해보세요</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((memo, idx) => {
            const bg = CARD_COLORS[idx % CARD_COLORS.length]
            return (
              <div key={memo.id} className="rounded-3xl p-4 flex flex-col gap-2 relative group border border-white/[0.04]"
                style={{ backgroundColor: bg }}>
                {memo.pinned && (
                  <div className="absolute top-3.5 right-3.5">
                    <Pin size={11} className="text-[#F5BE3A]" fill="#F5BE3A" />
                  </div>
                )}

                <h3 className="text-[13px] font-bold text-white leading-tight pr-5 truncate">
                  {memo.title || '(제목 없음)'}
                </h3>

                {memo.content && (
                  <p className="text-[12px] text-[#8B95A1] whitespace-pre-wrap line-clamp-5 leading-relaxed flex-1">
                    {memo.content}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/[0.05]">
                  <span className="text-[10px] text-[#4E5968]">{formatDate(memo.updatedAt)}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onTogglePin(memo.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title={memo.pinned ? '핀 해제' : '고정'}>
                      <Pin size={10} className={memo.pinned ? 'text-[#F5BE3A]' : 'text-[#4E5968]'} />
                    </button>
                    <button onClick={() => openEdit(memo)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <Pencil size={10} className="text-[#4E5968]" />
                    </button>
                    <button onClick={() => onDelete(memo.id)} className="p-1.5 rounded-lg hover:bg-[#F25260]/15 transition-colors">
                      <Trash2 size={10} className="text-[#F25260]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
