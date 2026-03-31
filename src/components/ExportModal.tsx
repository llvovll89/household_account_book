import { useState } from 'react'
import { X, Download, FileText } from 'lucide-react'
import type { Transaction } from '../types'
import { exportTransactionsCSV } from '../lib/exportCsv'
import { showToast } from '../lib/toast'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  onClose: () => void
}

type Range = 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom'

function getYearMonth(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ExportModal({ transactions, yearMonth, onClose }: Props) {
  const [range, setRange] = useState<Range>('thisMonth')
  const [customFrom, setCustomFrom] = useState(`${yearMonth}-01`)
  const [customTo, setCustomTo] = useState(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return `${yearMonth}-${String(last).padStart(2, '0')}`
  })

  function getFiltered(): Transaction[] {
    const now = new Date()
    const thisYear = String(now.getFullYear())
    switch (range) {
      case 'thisMonth':
        return transactions.filter((t) => t.date.startsWith(yearMonth))
      case 'lastMonth': {
        const last = getYearMonth(-1)
        return transactions.filter((t) => t.date.startsWith(last))
      }
      case 'thisYear':
        return transactions.filter((t) => t.date.startsWith(thisYear))
      case 'custom':
        return transactions.filter((t) => t.date >= customFrom && t.date <= customTo)
      default:
        return transactions
    }
  }

  function getFilename(): string {
    const now = new Date()
    switch (range) {
      case 'thisMonth': return `가계부_${yearMonth}.csv`
      case 'lastMonth': return `가계부_${getYearMonth(-1)}.csv`
      case 'thisYear': return `가계부_${now.getFullYear()}년.csv`
      case 'custom': return `가계부_${customFrom}_${customTo}.csv`
      default: return `가계부_전체.csv`
    }
  }

  const filtered = getFiltered()

  function handleExport() {
    if (filtered.length === 0) return
    exportTransactionsCSV(filtered, getFilename())
    showToast(`${filtered.length}개 내역을 다운로드했어요`)
    onClose()
  }

  const RANGES: { id: Range; label: string }[] = [
    { id: 'thisMonth', label: '이번 달' },
    { id: 'lastMonth', label: '지난 달' },
    { id: 'thisYear', label: '올해 전체' },
    { id: 'all', label: '전체 기간' },
    { id: 'custom', label: '직접 설정' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] border-t border-white/[0.06]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-5">
          <div>
            <h2 className="text-[18px] font-bold text-white">내역 내보내기</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">CSV 파일로 다운로드 (Excel 호환)</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-4">
          {/* 기간 선택 */}
          <div className="grid grid-cols-2 gap-2">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                  range === r.id
                    ? 'bg-[#3D8EF8] text-white'
                    : 'bg-[#252A3F] text-[#8B95A1] hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* 직접 설정 날짜 */}
          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#252A3F] rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">시작일</p>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                />
              </div>
              <div className="bg-[#252A3F] rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">종료일</p>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 미리보기 */}
          <div className="flex items-center gap-3 bg-[#252A3F] rounded-2xl px-4 py-3.5">
            <FileText size={18} className="text-[#3D8EF8] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{getFilename()}</p>
              <p className="text-xs text-[#4E5968] mt-0.5">
                {filtered.length > 0
                  ? `${filtered.length}개 내역 · 수입 ${filtered.filter(t => t.type === 'income').length}건 · 지출 ${filtered.filter(t => t.type === 'expense').length}건`
                  : '해당 기간에 내역이 없습니다'}
              </p>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] disabled:opacity-30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Download size={18} />
            {filtered.length}개 내역 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}
