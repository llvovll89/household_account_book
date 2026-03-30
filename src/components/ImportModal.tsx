import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, AlertCircle, CheckCircle2, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react'
import type { Transaction } from '../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJI } from '../types'
import {
  parseTabularFile, applyMapping, detectColumns, guessCategory,
  extractPDFText, parsePDFText, type ColumnMapping, type ParsedRow,
} from '../lib/bankParser'

interface Props {
  existingTransactions: Transaction[]
  onImport: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void
  onClose: () => void
}

type Step = 'upload' | 'mapping' | 'preview'
interface PreviewRow extends ParsedRow { category: string; skip: boolean; isDuplicate: boolean }

const EMPTY_MAPPING: ColumnMapping = { date: '', deposit: '', withdrawal: '', amount: '', typeCol: '', description: '' }
const PAGE_SIZE = 30

export default function ImportModal({ existingTransactions, onImport, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ ...EMPTY_MAPPING })
  const [isPDF, setIsPDF] = useState(false)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [detailIdx, setDetailIdx] = useState<number | null>(null)

  // 컬럼 매핑 단계 — 가로 휠 스크롤
  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (el!.scrollWidth > el!.clientWidth) {
        e.preventDefault()
        el!.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [step])

  // 무한 스크롤 — sentinel 감지
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((n) => Math.min(n + PAGE_SIZE, previewRows.length))
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [previewRows.length, step])

  async function handleFile(file: File) {
    setError(''); setLoading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf') {
        setIsPDF(true)
        const text = await extractPDFText(file)
        const parsed = parsePDFText(text)
        if (!parsed.length) { setError('PDF에서 내역을 찾지 못했습니다. CSV 파일을 사용해주세요.'); return }
        buildPreview(parsed); setStep('preview')
      } else {
        setIsPDF(false)
        const { headers, rows } = await parseTabularFile(file)
        if (!headers.length) { setError('파일을 읽지 못했습니다. CSV 또는 엑셀 파일인지 확인해주세요.'); return }
        setCsvHeaders(headers); setCsvRows(rows)
        setMapping({ ...EMPTY_MAPPING, ...detectColumns(headers) }); setStep('mapping')
      }
    } catch (e) { setError('파일 파싱 중 오류가 발생했습니다.'); console.error(e) }
    finally { setLoading(false) }
  }

  function buildPreview(parsed: ParsedRow[]) {
    const existingSet = new Set(existingTransactions.map((t) => `${t.date}|${t.amount}|${t.type}`))
    setVisibleCount(PAGE_SIZE)
    setPreviewRows(parsed.map((p) => {
      const isDuplicate = existingSet.has(`${p.date}|${p.amount}|${p.type}`)
      return { ...p, category: guessCategory(p.description, p.type), skip: isDuplicate, isDuplicate }
    }))
  }

  function proceedToPreview() {
    if (!mapping.date) { setError('날짜 컬럼을 선택해주세요.'); return }
    if (!mapping.deposit && !mapping.withdrawal && !mapping.amount) { setError('금액 컬럼을 선택해주세요.'); return }
    setError('')
    const parsed = applyMapping(csvRows, mapping)
    if (!parsed.length) { setError('파싱된 내역이 없습니다. 컬럼 설정을 확인해주세요.'); return }
    buildPreview(parsed); setStep('preview')
  }

  function handleImport() {
    onImport(previewRows.filter((r) => !r.skip).map(({ type, amount, category, description, date }) => ({ type, amount, category, description, date })))
    onClose()
  }

  const updateRow = useCallback((idx: number, patch: Partial<PreviewRow>) => {
    setPreviewRows((rows) => rows.map((r, j) => j === idx ? { ...r, ...patch } : r))
  }, [])

  const importCount = previewRows.filter((r) => !r.skip).length
  const dupCount = previewRows.filter((r) => r.isDuplicate).length
  const visibleRows = previewRows.slice(0, visibleCount)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] max-h-[92vh] flex flex-col border-t border-white/[0.06]">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 bg-white/10 rounded-full" />
          </div>
          <div className="flex items-start justify-between px-6 pt-2 pb-4 shrink-0">
            <div>
              <h2 className="text-[18px] font-bold text-white">은행 내역 가져오기</h2>
              <p className="text-xs text-[#4E5968] mt-0.5">CSV · PDF · 농협 · 대구 · 국민 · 신한 · 우리 · 하나</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center mt-0.5">
              <X size={16} className="text-[#8B95A1]" />
            </button>
          </div>

          {/* 스텝 */}
          <div className="flex items-center px-6 pb-4 gap-1 shrink-0">
            {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => {
              const done = (step === 'preview' && s !== 'preview') || (step === 'mapping' && s === 'upload')
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    step === s ? 'bg-[#3D8EF8] text-white' : done ? 'bg-[#2ACF6A] text-white' : 'bg-[#252A3F] text-[#4E5968]'
                  }`}>{done ? '✓' : i + 1}</div>
                  <span className={`text-[11px] font-semibold ${step === s ? 'text-[#3D8EF8]' : 'text-[#4E5968]'}`}>
                    {s === 'upload' ? '파일' : s === 'mapping' ? '컬럼' : '확인'}
                  </span>
                  {i < 2 && <div className="flex-1 h-px bg-white/[0.06] ml-1" />}
                </div>
              )
            })}
          </div>

          <div className="overflow-y-auto flex-1 px-6 pb-6">
            {/* STEP 1 */}
            {step === 'upload' && (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-3xl p-10 flex flex-col items-center gap-5 cursor-pointer transition-all border ${
                  isDragging ? 'bg-[#3D8EF8]/10 border-[#3D8EF8]/40' : 'bg-[#252A3F] border-white/[0.05] hover:border-white/10'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDragging ? 'bg-[#3D8EF8]/20' : 'bg-[#2D3352]'}`}>
                  <Upload size={28} className={isDragging ? 'text-[#3D8EF8]' : 'text-[#4E5968]'} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-[15px]">파일을 여기에 올려주세요</p>
                  <p className="text-sm text-[#4E5968] mt-1">CSV, PDF 형식 지원</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {['농협', '대구은행', '국민', '신한', '우리', '하나', 'IBK'].map((b) => (
                    <span key={b} className="px-2.5 py-1 bg-[#2D3352] rounded-full text-xs font-medium text-[#8B95A1]">{b}</span>
                  ))}
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.pdf,.xls,.xlsx,.txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            )}

            {/* STEP 2 */}
            {step === 'mapping' && (
              <div className="space-y-4">
                <div className="bg-[#252A3F] rounded-2xl px-4 py-3">
                  <p className="text-sm text-[#8B95A1]">
                    <span className="font-bold text-white">{csvRows.length}개</span> 행을 읽었습니다. 컬럼을 지정해주세요.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MappingSelect label="날짜 컬럼 *" value={mapping.date} headers={csvHeaders} onChange={(v) => setMapping((m) => ({ ...m, date: v }))} />
                  <MappingSelect label="설명/적요" value={mapping.description} headers={csvHeaders} optional onChange={(v) => setMapping((m) => ({ ...m, description: v }))} />
                  <MappingSelect label="입금 컬럼" value={mapping.deposit} headers={csvHeaders} optional onChange={(v) => setMapping((m) => ({ ...m, deposit: v }))} />
                  <MappingSelect label="출금 컬럼" value={mapping.withdrawal} headers={csvHeaders} optional onChange={(v) => setMapping((m) => ({ ...m, withdrawal: v }))} />
                  <MappingSelect label="단일 금액" value={mapping.amount} headers={csvHeaders} optional onChange={(v) => setMapping((m) => ({ ...m, amount: v }))} />
                  <MappingSelect label="입출금 구분" value={mapping.typeCol} headers={csvHeaders} optional onChange={(v) => setMapping((m) => ({ ...m, typeCol: v }))} />
                </div>
                <div ref={tableScrollRef} className="table-h-scroll rounded-2xl overflow-x-auto border border-white/[0.05] relative">
                  <table className="w-full text-xs">
                    <thead className="bg-[#252A3F]">
                      <tr>{csvHeaders.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-[#4E5968] whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {csvRows.map((row, i) => (
                        <tr key={i}>
                          {csvHeaders.map((h) => <td key={h} className="px-3 py-2 text-[#8B95A1] whitespace-nowrap max-w-[100px] truncate">{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={proceedToPreview} className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] transition-colors">
                  다음
                </button>
              </div>
            )}

            {/* STEP 3 */}
            {step === 'preview' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#3D8EF8]/10 rounded-2xl p-3 text-center border border-[#3D8EF8]/15">
                    <p className="text-xl font-bold text-[#3D8EF8] num">{importCount}</p>
                    <p className="text-[10px] text-[#3D8EF8]/70 font-semibold mt-0.5">가져올 내역</p>
                  </div>
                  <div className={`rounded-2xl p-3 text-center border ${dupCount > 0 ? 'bg-[#F5BE3A]/10 border-[#F5BE3A]/15' : 'bg-[#252A3F] border-white/[0.04]'}`}>
                    <p className={`text-xl font-bold num ${dupCount > 0 ? 'text-[#F5BE3A]' : 'text-[#4E5968]'}`}>{dupCount}</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${dupCount > 0 ? 'text-[#F5BE3A]/70' : 'text-[#4E5968]'}`}>중복 제외</p>
                  </div>
                  <div className="bg-[#252A3F] rounded-2xl p-3 text-center border border-white/[0.04]">
                    <p className="text-xl font-bold text-[#8B95A1] num">{previewRows.length}</p>
                    <p className="text-[10px] text-[#4E5968] font-semibold mt-0.5">전체</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.05] overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#252A3F]">
                      <tr>
                        <th className="px-3 py-2.5 w-10">
                          <input type="checkbox" checked={previewRows.every((r) => !r.skip)}
                            onChange={(e) => setPreviewRows((rows) => rows.map((r) => ({ ...r, skip: !e.target.checked })))}
                            className="rounded w-3.5 h-3.5 accent-[#3D8EF8]" />
                        </th>
                        {['날짜', '설명', '카테고리', '금액'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#4E5968]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {visibleRows.map((row, i) => (
                        <tr key={i}
                          className={`cursor-pointer transition-colors hover:bg-white/[0.03] active:bg-white/[0.06] ${row.skip ? 'opacity-30' : ''}`}
                          onClick={() => setDetailIdx(i)}>
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={!row.skip}
                              onChange={(e) => updateRow(i, { skip: !e.target.checked })}
                              className="rounded w-3.5 h-3.5 accent-[#3D8EF8]" />
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#8B95A1] whitespace-nowrap">{row.date}</td>
                          <td className="px-3 py-2.5 text-[11px] text-[#8B95A1] max-w-[90px] truncate">{row.description || '-'}</td>
                          <td className="px-3 py-2.5 text-[11px] text-[#8B95A1] whitespace-nowrap">
                            {CATEGORY_EMOJI[row.category]} {row.category}
                          </td>
                          <td className={`px-3 py-2.5 text-[11px] font-bold text-right num whitespace-nowrap ${row.type === 'income' ? 'text-[#2ACF6A]' : 'text-white'}`}>
                            {row.type === 'income' ? '+' : '-'}{row.amount.toLocaleString()}원
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* 무한 스크롤 sentinel */}
                  {visibleCount < previewRows.length && (
                    <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[#4E5968]">
                      {visibleCount} / {previewRows.length}행 표시 중...
                    </div>
                  )}
                </div>

                {isPDF && (
                  <div className="flex items-center gap-2 p-3.5 bg-[#3D8EF8]/10 rounded-2xl border border-[#3D8EF8]/15">
                    <AlertCircle size={13} className="text-[#3D8EF8] shrink-0" />
                    <p className="text-xs text-[#3D8EF8] font-medium">PDF 파싱 정확도가 낮을 수 있어요. 가져온 후 확인해주세요.</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 p-3.5 bg-[#F25260]/10 rounded-2xl border border-[#F25260]/15">
                <AlertCircle size={13} className="text-[#F25260] shrink-0" />
                <p className="text-sm text-[#F25260] font-medium">{error}</p>
              </div>
            )}
            {loading && <div className="mt-6 text-center text-sm text-[#4E5968] font-medium animate-pulse">파일 분석 중...</div>}
          </div>

          {step === 'preview' && (
            <div className="px-6 pb-8 pt-3 border-t border-white/[0.05] shrink-0 flex gap-3">
              <button onClick={() => setStep(isPDF ? 'upload' : 'mapping')}
                className="flex-1 py-4 rounded-2xl font-bold text-[#8B95A1] bg-[#252A3F] hover:bg-[#2D3352] transition-colors">
                이전
              </button>
              <button onClick={handleImport} disabled={importCount === 0}
                className="flex-1 py-4 rounded-2xl font-bold text-white bg-[#3D8EF8] hover:bg-[#5AA0FF] disabled:opacity-30 transition-colors flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                {importCount}개 가져오기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 행 상세 모달 — 최상위 레이어 */}
      {detailIdx !== null && (
        <RowDetailModal
          row={previewRows[detailIdx]}
          onClose={() => setDetailIdx(null)}
          onUpdate={(patch) => updateRow(detailIdx, patch)}
        />
      )}
    </>
  )
}

function RowDetailModal({ row, onClose, onUpdate }: {
  row: PreviewRow
  onClose: () => void
  onUpdate: (patch: Partial<PreviewRow>) => void
}) {
  const isIncome = row.type === 'income'
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]"
      onClick={onClose}>
      <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] border-t border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>
        <div className="px-6 pt-3 pb-8 space-y-4">
          {/* 헤더 */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isIncome ? 'bg-[#3D8EF8]/15' : 'bg-[#F25260]/15'}`}>
                {isIncome
                  ? <TrendingUp size={18} className="text-[#3D8EF8]" />
                  : <TrendingDown size={18} className="text-[#F25260]" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#4E5968]">{row.date}</p>
                <p className={`text-xl font-extrabold num ${isIncome ? 'text-[#3D8EF8]' : 'text-white'}`}>
                  {isIncome ? '+' : '-'}{row.amount.toLocaleString()}원
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
              <X size={15} className="text-[#8B95A1]" />
            </button>
          </div>

          {/* 적요 */}
          {row.description && (
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3">
              <p className="text-[10px] font-semibold text-[#4E5968] mb-1">적요</p>
              <p className="text-sm text-white break-all">{row.description}</p>
            </div>
          )}

          {/* 카테고리 */}
          <div>
            <p className="text-[10px] font-semibold text-[#4E5968] mb-2">카테고리</p>
            <div className="grid grid-cols-4 gap-2">
              {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                <button key={c}
                  onClick={() => onUpdate({ category: c })}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl text-[10px] font-semibold transition-all ${
                    row.category === c
                      ? 'bg-[#3D8EF8] text-white'
                      : 'bg-[#252A3F] text-[#8B95A1] hover:bg-[#2D3352]'
                  }`}>
                  <span className="text-base">{CATEGORY_EMOJI[c]}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 포함/제외 토글 */}
          <div className="flex gap-3">
            <button
              onClick={() => { onUpdate({ skip: true }); onClose() }}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${row.skip ? 'bg-[#F25260]/20 text-[#F25260]' : 'bg-[#252A3F] text-[#8B95A1] hover:bg-[#2D3352]'}`}>
              제외
            </button>
            <button
              onClick={() => { onUpdate({ skip: false }); onClose() }}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${!row.skip ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'bg-[#252A3F] text-[#8B95A1] hover:bg-[#2D3352]'}`}>
              포함
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MappingSelect({ label, value, headers, optional, onChange }: {
  label: string; value: string; headers: string[]; optional?: boolean; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#4E5968] mb-1.5">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#252A3F] border border-white/[0.06] rounded-xl px-3 py-2.5 pr-8 text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40 appearance-none">
          <option value="" className="text-[#4E5968]">{optional ? '없음' : '선택'}</option>
          {headers.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
      </div>
    </div>
  )
}
