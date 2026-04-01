import { useMemo, useState } from 'react'
import { Pencil, Trash2, Search, X, CalendarDays, List as ListIcon, FileDown } from 'lucide-react'
import type { Transaction } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'
import CalendarView from './CalendarView'
import ExportModal from './ExportModal'
import { fmt } from '../lib/format'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
}

type ViewMode = 'list' | 'calendar'

type FilterType = 'all' | 'income' | 'expense'

export default function TransactionList({ transactions, yearMonth, onEdit, onDelete }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showExport, setShowExport] = useState(false)

  const monthly = useMemo(
    () =>
      transactions
        .filter((t) => t.date.startsWith(yearMonth))
        .filter((t) => filter === 'all' || t.type === filter)
        .filter((t) =>
          !search ||
          t.category.includes(search) ||
          t.description.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [transactions, yearMonth, filter, search]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    monthly.forEach((t) => {
      const list = map.get(t.date) || []
      list.push(t)
      map.set(t.date, list)
    })
    return Array.from(map.entries())
  }, [monthly])

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (dateStr === today) return '오늘'
    if (dateStr === yesterday) return '어제'
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
  }

  function getDayBalance(list: Transaction[]) {
    const inc = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return inc - exp
  }

  return (
    <div className="space-y-3 tab-content">
      {/* 뷰 전환 + 내보내기 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-[#1E2236] rounded-2xl p-1 gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'list' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'
            }`}
          >
            <ListIcon size={13} /> 목록
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'calendar' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'
            }`}
          >
            <CalendarDays size={13} /> 캘린더
          </button>
        </div>
        <button
          onClick={() => setShowExport(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1E2236] text-[#8B95A1] hover:text-white text-xs font-bold transition-colors"
        >
          <FileDown size={13} /> 내보내기
        </button>
      </div>

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <CalendarView
          transactions={transactions}
          yearMonth={yearMonth}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* 목록 뷰 */}
      {viewMode === 'list' && <>

      {/* 검색 */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4E5968]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="카테고리, 설명으로 검색"
          className="w-full bg-[#1E2236] text-white placeholder-[#4E5968] text-sm font-medium rounded-2xl pl-10 pr-10 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="absolute right-4 top-1/2 -translate-y-1/2">
            <X size={14} className="text-[#4E5968]" />
          </button>
        )}
      </div>

      {/* 필터 탭 */}
      <div className="bg-[#1E2236] rounded-2xl p-1 flex">
        {(['all', 'income', 'expense'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === f
                ? 'bg-[#3D8EF8] text-white'
                : 'text-[#4E5968] hover:text-[#8B95A1]'
            }`}
          >
            {f === 'all' ? '전체' : f === 'income' ? '수입' : '지출'}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">{search ? '🔍' : '📋'}</p>
          <p className="font-bold text-white text-[15px]">
            {search ? `"${search}" 검색 결과 없음` : '내역이 없어요'}
          </p>
        </div>
      ) : (
        grouped.map(([date, list]) => {
          const dayBalance = getDayBalance(list)
          return (
            <div key={date} className="bg-[#1E2236] rounded-3xl overflow-hidden">
              {/* 날짜 헤더 */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <span className="text-sm font-bold text-white">{formatDate(date)}</span>
                <span className={`text-sm font-bold num ${dayBalance >= 0 ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                  {dayBalance >= 0 ? '+' : ''}{fmt(dayBalance)}원
                </span>
              </div>

              <div>
                {list.map((t, idx) => {
                  const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 px-5 py-3.5 group ${
                        idx < list.length - 1 ? 'border-b border-white/[0.04]' : ''
                      }`}
                    >
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: color.bg }}
                      >
                        {CATEGORY_EMOJI[t.category] ?? '📦'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white leading-tight">{t.category}</p>
                        {t.description && (
                          <p className="text-xs text-[#4E5968] truncate mt-0.5">{t.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="text-[14px] font-bold num"
                          style={{ color: t.type === 'income' ? '#2ACF6A' : '#F1F3F6' }}
                        >
                          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}원
                        </span>
                        <div className="flex gap-0.5 ml-1">
                          <button
                            onClick={() => onEdit(t)}
                            aria-label={`${t.category} 내역 수정`}
                            className="p-1.5 rounded-xl hover:bg-[#3D8EF8]/15 text-[#4E5968] hover:text-[#3D8EF8] transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => onDelete(t.id)}
                            aria-label={`${t.category} 내역 삭제`}
                            className="p-1.5 rounded-xl hover:bg-[#F25260]/15 text-[#4E5968] hover:text-[#F25260] transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      </> /* end list view */}

      {showExport && (
        <ExportModal
          transactions={transactions}
          yearMonth={yearMonth}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
