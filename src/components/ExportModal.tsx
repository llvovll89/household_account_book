import { useState, useMemo } from 'react'
import { X, Download, FileText, Archive, AlertTriangle } from 'lucide-react'
import type { Transaction } from '../types'
import { exportTransactionsCSV } from '../lib/exportCsv'
import { archiveTransactionsBefore, getLocalStorageUsageBytes } from '../lib/storage'
import { showToast } from '../lib/toast'
import FancyDatePicker from './FancyDatePicker'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  onClose: () => void
  onArchiveDone: (cutoff: string) => void
}

type Range = 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom'

const LOCAL_STORAGE_MAX_BYTES = 5 * 1024 * 1024 // 5MB

function getYearMonth(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

export default function ExportModal({ transactions, yearMonth, onClose, onArchiveDone }: Props) {
  const [range, setRange] = useState<Range>('thisMonth')
  const [customFrom, setCustomFrom] = useState(`${yearMonth}-01`)
  const [customTo, setCustomTo] = useState(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return `${yearMonth}-${String(last).padStart(2, '0')}`
  })
  const [archiving, setArchiving] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)

  const storageUsed = useMemo(() => getLocalStorageUsageBytes(), [])
  const usagePct = Math.min((storageUsed / LOCAL_STORAGE_MAX_BYTES) * 100, 100)
  const isStorageWarning = usagePct >= 70

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
      case 'thisMonth': return `잔고플랜_${yearMonth}.csv`
      case 'lastMonth': return `잔고플랜_${getYearMonth(-1)}.csv`
      case 'thisYear': return `잔고플랜_${now.getFullYear()}년.csv`
      case 'custom': return `잔고플랜_${customFrom}_${customTo}.csv`
      default: return `잔고플랜_전체.csv`
    }
  }

  // 아카이브 기준일: 선택 범위의 마지막 날 다음 날
  function getArchiveCutoff(): string | null {
    switch (range) {
      case 'lastMonth': {
        const last = getYearMonth(-1)
        const [y, m] = last.split('-').map(Number)
        const nextMonth = new Date(y, m, 1)
        return nextMonth.toISOString().slice(0, 10)
      }
      case 'custom': {
        const d = new Date(customTo)
        d.setDate(d.getDate() + 1)
        return d.toISOString().slice(0, 10)
      }
      case 'thisYear': {
        const year = new Date().getFullYear()
        return `${year + 1}-01-01`
      }
      case 'all':
        return null // 전체 삭제는 허용하지 않음
      default:
        return null
    }
  }

  const filtered = getFiltered()
  const archiveCutoff = getArchiveCutoff()
  const canArchive = archiveCutoff !== null && filtered.length > 0

  function handleExport() {
    if (filtered.length === 0) return
    exportTransactionsCSV(filtered, getFilename())
    showToast(`${filtered.length}개 내역을 다운로드했어요`)
    onClose()
  }

  async function handleArchive() {
    if (!archiveCutoff) return
    setArchiving(true)
    try {
      // 먼저 CSV 내보내기
      exportTransactionsCSV(filtered, getFilename())
      // 그 다음 삭제
      const removed = await archiveTransactionsBefore(archiveCutoff)
      onArchiveDone(archiveCutoff)
      showToast(`${removed}개 내역을 내보내고 삭제했어요`)
      onClose()
    } catch {
      showToast('아카이브 중 오류가 발생했어요')
    } finally {
      setArchiving(false)
      setArchiveConfirm(false)
    }
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
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] border-t border-white/6">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-5">
          <div>
            <h2 className="text-[18px] font-bold text-white">내역 내보내기</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">CSV 파일로 다운로드 (Excel 호환)</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-4">
          {/* 스토리지 사용량 */}
          <div className={`rounded-2xl px-4 py-3 ${isStorageWarning ? 'bg-[#F25260]/10 border border-[#F25260]/30' : 'bg-[#2C2C2E]'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {isStorageWarning && <AlertTriangle size={13} className="text-[#F5BE3A]" />}
                <span className="text-[11px] font-semibold text-[#8B95A1]">저장 공간</span>
              </div>
              <span className={`text-[11px] font-bold num ${isStorageWarning ? 'text-[#F5BE3A]' : 'text-[#F1F3F6]'}`}>
                {fmtBytes(storageUsed)} / 5MB
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-[#F25260]' : usagePct >= 70 ? 'bg-[#F5BE3A]' : 'bg-[#2ACF6A]'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {isStorageWarning && (
              <p className="text-[10px] text-[#F5BE3A] mt-1.5">
                저장 공간이 부족합니다. 오래된 내역을 내보내고 정리하세요.
              </p>
            )}
          </div>

          {/* 기간 선택 */}
          <div className="grid grid-cols-2 gap-2">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRange(r.id); setArchiveConfirm(false) }}
                className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                  range === r.id
                    ? 'bg-[#3D8EF8] text-white'
                    : 'bg-[#2C2C2E] text-[#8B95A1] hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* 직접 설정 날짜 */}
          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">시작일</p>
                <FancyDatePicker
                  value={customFrom}
                  onChange={setCustomFrom}
                  max={customTo}
                  size="sm"
                />
              </div>
              <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">종료일</p>
                <FancyDatePicker
                  value={customTo}
                  onChange={setCustomTo}
                  min={customFrom}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* 미리보기 */}
          <div className="flex items-center gap-3 bg-[#2C2C2E] rounded-2xl px-4 py-3.5">
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

          {/* 아카이브 확인 메시지 */}
          {archiveConfirm && (
            <div className="bg-[#F25260]/10 border border-[#F25260]/30 rounded-2xl px-4 py-3.5">
              <p className="text-sm font-semibold text-[#F25260] mb-1">정말 삭제할까요?</p>
              <p className="text-xs text-[#8B95A1]">
                CSV를 먼저 내보낸 뒤 앱에서 {filtered.length}개 내역을 삭제합니다. 이 작업은 되돌릴 수 없어요.
              </p>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] disabled:opacity-30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Download size={18} />
            {filtered.length}개 내역 다운로드
          </button>

          {/* 아카이브 버튼 (이번 달·전체 제외) */}
          {canArchive && (
            archiveConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setArchiveConfirm(false)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-[#8B95A1] text-sm bg-[#2C2C2E]"
                >
                  취소
                </button>
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-white text-sm bg-[#F25260] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {archiving ? '처리 중...' : '내보내고 삭제'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setArchiveConfirm(true)}
                className="w-full py-3.5 rounded-2xl font-bold text-[#8B95A1] text-sm bg-[#2C2C2E] hover:text-white flex items-center justify-center gap-2"
              >
                <Archive size={16} />
                내보내고 앱에서 삭제 (아카이브)
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
