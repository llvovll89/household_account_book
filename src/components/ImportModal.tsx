import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import type { Transaction } from '../types'
import { CATEGORY_EMOJI } from '../types'
import {
  parseTabularFile, applyMapping, detectColumns, guessCategory,
  extractPDFText, parsePDFText, type ColumnMapping, type ParsedRow,
} from '../lib/bankParser'
import MappingRowDetailModal from './import/MappingRowDetailModal'
import PreviewRowDetailModal from './import/PreviewRowDetailModal'

interface Props {
  existingTransactions: Transaction[]
  onImport: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void
  onClose: () => void
}

type Step = 'upload' | 'mapping' | 'preview'
interface PreviewRow extends ParsedRow { category: string; skip: boolean; isDuplicate: boolean }

const EMPTY_MAPPING: ColumnMapping = { date: '', deposit: '', withdrawal: '', amount: '', typeCol: '', description: '' }
const PAGE_SIZE = 30
const MAPPING_PAGE_SIZE = 30

function isNarrowColumn(header: string): boolean {
  return /^(순번|번호|no|index)$/i.test(header.trim())
}

function isWideTextColumn(header: string): boolean {
  return /(거래내용|내용|적요|메모|비고|상호|가맹점|description|memo|note)/i.test(header.trim())
}

function isDateTimeColumn(header: string): boolean {
  return /(거래일시|일시|날짜|시간|date|time)/i.test(header.trim())
}

function isMeaningfulDataRow(row: Record<string, string>): boolean {
  const values = Object.values(row)
    .map((v) => (v ?? '').trim())
    .filter(Boolean)

  if (values.length === 0) return false

  const joined = values.join(' ')
  const noticePattern = /(고객님이\s*요청하신|본\s*확인용은\s*고객님의\s*편의를\s*위하여\s*제공|문의|안내\s*문구|감사합니다)/

  // 하단 안내문은 보통 단일 셀의 긴 문장으로 들어오는 경우가 많음
  if (values.length === 1 && values[0].length >= 30 && noticePattern.test(values[0])) {
    return false
  }

  if (noticePattern.test(joined)) {
    return false
  }

  return true
}

export default function ImportModal({ existingTransactions, onImport, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mappingTableRef = useRef<HTMLDivElement>(null)
  const previewTableRef = useRef<HTMLDivElement>(null)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ ...EMPTY_MAPPING })
  const [isPDF, setIsPDF] = useState(false)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [mappingVisibleCount, setMappingVisibleCount] = useState(MAPPING_PAGE_SIZE)
  const [mappingDetailIdx, setMappingDetailIdx] = useState<number | null>(null)
  const [detailIdx, setDetailIdx] = useState<number | null>(null)

  // 프리뷰 진입 시 무한 스크롤 초기화
  useEffect(() => {
    if (step === 'preview') setVisibleCount(PAGE_SIZE)
  }, [step])

  // 매핑 진입 시 페이지네이션 초기화
  useEffect(() => {
    if (step === 'mapping') {
      setMappingVisibleCount(MAPPING_PAGE_SIZE)
      setMappingDetailIdx(null)
    }
  }, [step, csvRows.length])

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
        const filteredRows = rows.filter(isMeaningfulDataRow)
        setCsvHeaders(headers); setCsvRows(filteredRows)
        setMapping({ ...EMPTY_MAPPING, ...detectColumns(headers) }); setStep('mapping')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(`파일 파싱 중 오류가 발생했습니다: ${msg}`)
      console.error('[ImportModal] 파일 파싱 오류:', e)
    }
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

  function openDetail(idx: number) {
    if (idx < 0 || idx >= previewRows.length) return
    setDetailIdx(idx)
  }

  const importCount = previewRows.filter((r) => !r.skip).length
  const dupCount = previewRows.filter((r) => r.isDuplicate).length

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[92vh] flex flex-col border-t border-white/[0.06]">

          {/* 핸들 */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 bg-white/10 rounded-full" />
          </div>

          {/* 제목 */}
          <div className="flex items-start justify-between px-6 pt-2 pb-4 shrink-0">
            <div>
              <h2 className="text-[18px] font-bold text-white">은행 내역 가져오기</h2>
              <p className="text-xs text-[#4E5968] mt-0.5">CSV · PDF · 농협 · 대구 · 국민 · 신한 · 우리 · 하나</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center mt-0.5">
              <X size={16} className="text-[#8B95A1]" />
            </button>
          </div>

          {/* 스텝 인디케이터 */}
          <div className="flex items-center px-6 pb-4 gap-1 shrink-0">
            {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => {
              const done = (step === 'preview' && s !== 'preview') || (step === 'mapping' && s === 'upload')
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    step === s ? 'bg-[#3D8EF8] text-white' : done ? 'bg-[#2ACF6A] text-white' : 'bg-[#2C2C2E] text-[#4E5968]'
                  }`}>{done ? '✓' : i + 1}</div>
                  <span className={`text-[11px] font-semibold ${step === s ? 'text-[#3D8EF8]' : 'text-[#4E5968]'}`}>
                    {s === 'upload' ? '파일' : s === 'mapping' ? '컬럼' : '확인'}
                  </span>
                  {i < 2 && <div className="flex-1 h-px bg-white/[0.06] ml-1" />}
                </div>
              )
            })}
          </div>

          {/* ── STEP 1: 업로드 ── */}
          {step === 'upload' && (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-2xl p-10 flex flex-col items-center gap-5 cursor-pointer transition-all border ${
                  isDragging ? 'bg-[#3D8EF8]/10 border-[#3D8EF8]/40' : 'bg-[#2C2C2E] border-white/[0.05] hover:border-white/10'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDragging ? 'bg-[#3D8EF8]/20' : 'bg-[#3A3A3C]'}`}>
                  <Upload size={28} className={isDragging ? 'text-[#3D8EF8]' : 'text-[#4E5968]'} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-[15px]">파일을 여기에 올려주세요</p>
                  <p className="text-sm text-[#4E5968] mt-1">CSV, PDF 형식 지원</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {['농협', '대구은행', '국민', '신한', '우리', '하나', 'IBK'].map((b) => (
                    <span key={b} className="px-2.5 py-1 bg-[#3A3A3C] rounded-full text-xs font-medium text-[#8B95A1]">{b}</span>
                  ))}
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.pdf,.xls,.xlsx,.txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 p-3.5 bg-[#F25260]/10 rounded-2xl border border-[#F25260]/15">
                  <AlertCircle size={13} className="text-[#F25260] shrink-0" />
                  <p className="text-sm text-[#F25260] font-medium">{error}</p>
                </div>
              )}
              {loading && <div className="mt-6 text-center text-sm text-[#4E5968] font-medium animate-pulse">파일 분석 중...</div>}
            </div>
          )}

          {/* ── STEP 2: 컬럼 매핑 ── */}
          {step === 'mapping' && (
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
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
              {/* 가로+세로 스크롤 모두 허용, 시간값이 잘리지 않게 표시 */}
              <div
                ref={mappingTableRef}
                className="table-h-scroll rounded-2xl overflow-auto max-h-72 border border-white/[0.05]"
                onScroll={(e) => {
                  const target = e.currentTarget
                  const remain = target.scrollHeight - target.scrollTop - target.clientHeight
                  if (remain < 80) {
                    setMappingVisibleCount((n) => Math.min(n + MAPPING_PAGE_SIZE, csvRows.length))
                  }
                }}
              >
                <table className="w-max text-xs table-auto">
                  <thead className="bg-[#2C2C2E]">
                    <tr>
                      {csvHeaders.map((h) => (
                        <th
                          key={h}
                          className={`py-2 font-semibold text-[#4E5968] ${
                            isNarrowColumn(h)
                              ? 'px-2 w-8 min-w-8 max-w-8 text-center whitespace-nowrap'
                              : isWideTextColumn(h)
                                ? 'px-3 text-left min-w-40 whitespace-normal wrap-break-word'
                                : isDateTimeColumn(h)
                                  ? 'px-3 text-left min-w-32 whitespace-nowrap'
                                  : 'px-3 text-left whitespace-nowrap'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {csvRows.slice(0, mappingVisibleCount).map((row, i) => (
                      <tr
                        key={i}
                        title="행 클릭: 원본 상세 보기"
                        onClick={() => setMappingDetailIdx(i)}
                        className="cursor-pointer transition-colors hover:bg-white/[0.04] active:bg-white/[0.07]"
                      >
                        {csvHeaders.map((h) => (
                          <td
                            key={h}
                            title={row[h]}
                            className={`py-2 text-[#8B95A1] ${
                              isNarrowColumn(h)
                                ? 'px-2 w-8 min-w-8 max-w-8 text-center whitespace-nowrap'
                                : isWideTextColumn(h)
                                  ? 'px-3 min-w-40 max-w-60 whitespace-normal wrap-break-word leading-relaxed'
                                  : isDateTimeColumn(h)
                                    ? 'px-3 min-w-32 whitespace-nowrap'
                                    : 'px-3 whitespace-nowrap'
                            }`}
                          >
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappingVisibleCount < csvRows.length && (
                  <div className="py-2 text-center text-[11px] text-[#4E5968] space-y-1">
                    <p>{mappingVisibleCount} / {csvRows.length}행</p>
                    <button
                      type="button"
                      onClick={() => setMappingVisibleCount((n) => Math.min(n + MAPPING_PAGE_SIZE, csvRows.length))}
                      className="text-[#3D8EF8] hover:text-[#5AA0FF] font-semibold"
                    >
                      더 보기
                    </button>
                  </div>
                )}
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3.5 bg-[#F25260]/10 rounded-2xl border border-[#F25260]/15">
                  <AlertCircle size={13} className="text-[#F25260] shrink-0" />
                  <p className="text-sm text-[#F25260] font-medium">{error}</p>
                </div>
              )}
              <button onClick={proceedToPreview} className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] transition-colors">
                다음
              </button>
            </div>
          )}

          {/* ── STEP 3: 프리뷰 ── */}
          {step === 'preview' && (
            <>
              {/* 요약 카드 */}
              <div className="px-6 pb-3 shrink-0 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#3D8EF8]/10 rounded-2xl p-3 text-center border border-[#3D8EF8]/15">
                    <p className="text-xl font-bold text-[#3D8EF8] num">{importCount}</p>
                    <p className="text-[10px] text-[#3D8EF8]/70 font-semibold mt-0.5">가져올 내역</p>
                  </div>
                  <div className={`rounded-2xl p-3 text-center border ${dupCount > 0 ? 'bg-[#F5BE3A]/10 border-[#F5BE3A]/15' : 'bg-[#2C2C2E] border-white/[0.04]'}`}>
                    <p className={`text-xl font-bold num ${dupCount > 0 ? 'text-[#F5BE3A]' : 'text-[#4E5968]'}`}>{dupCount}</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${dupCount > 0 ? 'text-[#F5BE3A]/70' : 'text-[#4E5968]'}`}>중복 제외</p>
                  </div>
                  <div className="bg-[#2C2C2E] rounded-2xl p-3 text-center border border-white/[0.04]">
                    <p className="text-xl font-bold text-[#8B95A1] num">{previewRows.length}</p>
                    <p className="text-[10px] text-[#4E5968] font-semibold mt-0.5">전체</p>
                  </div>
                </div>
                {isPDF && (
                  <div className="flex items-center gap-2 p-3.5 bg-[#3D8EF8]/10 rounded-2xl border border-[#3D8EF8]/15">
                    <AlertCircle size={13} className="text-[#3D8EF8] shrink-0" />
                    <p className="text-xs text-[#3D8EF8] font-medium">PDF 파싱 정확도가 낮을 수 있어요. 가져온 후 확인해주세요.</p>
                  </div>
                )}
                <p className="text-[11px] text-[#4E5968] px-1">리스트에서 체크박스 제외 아무 영역을 누르면 상세 편집 창이 열립니다.</p>
              </div>

              {/* 테이블 — 단일 테이블 + sticky thead + flex-1로 남은 공간 채움 */}
              <div
                ref={previewTableRef}
                className="mx-6 flex-1 min-h-0 rounded-2xl border border-white/[0.05] overflow-auto"
                onScroll={(e) => {
                  const target = e.currentTarget
                  const remain = target.scrollHeight - target.scrollTop - target.clientHeight
                  if (remain < 80) {
                    setVisibleCount((n) => Math.min(n + PAGE_SIZE, previewRows.length))
                  }
                }}
              >
                <table className="w-max min-w-full text-xs">
                  <thead className="bg-[#2C2C2E] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10">
                        <input type="checkbox" checked={previewRows.length > 0 && previewRows.every((r) => !r.skip)}
                          onChange={(e) => setPreviewRows((rows) => rows.map((r) => ({ ...r, skip: !e.target.checked })))}
                          className="rounded w-3.5 h-3.5 accent-[#3D8EF8]" />
                      </th>
                      {['날짜', '설명', '카테고리', '금액'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#4E5968]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {previewRows.slice(0, visibleCount).map((row, i) => (
                      <tr key={i}
                        title="행 클릭: 상세 보기"
                        className={`cursor-pointer transition-colors hover:bg-white/[0.04] active:bg-white/[0.07] ${row.skip ? 'opacity-30' : ''}`}
                        onClick={() => openDetail(i)}>
                        <td className="px-3 py-2.5 w-10" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={!row.skip}
                            onChange={(e) => updateRow(i, { skip: !e.target.checked })}
                            className="rounded w-3.5 h-3.5 accent-[#3D8EF8]" />
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#8B95A1] whitespace-nowrap min-w-[88px]">{row.date}</td>
                        <td className="px-3 py-2.5 text-[11px] text-[#8B95A1] max-w-[90px] truncate">{row.description || '-'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-[#8B95A1] whitespace-nowrap">
                          {CATEGORY_EMOJI[row.category]} {row.category}
                        </td>
                        <td className={`px-3 py-2.5 text-[11px] font-bold text-right num whitespace-nowrap min-w-[92px] ${row.type === 'income' ? 'text-[#2ACF6A]' : 'text-white'}`}>
                          {row.type === 'income' ? '+' : '-'}{row.amount.toLocaleString()}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 무한 스크롤 상태 */}
                {visibleCount < previewRows.length && (
                  <div className="py-3 text-center text-[11px] text-[#4E5968]">
                    {visibleCount} / {previewRows.length}행
                  </div>
                )}
              </div>

              {/* 하단 버튼 */}
              <div className="px-6 pb-8 pt-3 border-t border-white/[0.05] shrink-0 flex gap-3">
                <button onClick={() => setStep(isPDF ? 'upload' : 'mapping')}
                  className="flex-1 py-4 rounded-2xl font-bold text-[#8B95A1] bg-[#2C2C2E] hover:bg-[#3A3A3C] transition-colors">
                  이전
                </button>
                <button onClick={handleImport} disabled={importCount === 0}
                  className="flex-1 py-4 rounded-2xl font-bold text-white bg-[#3D8EF8] hover:bg-[#5AA0FF] disabled:opacity-30 transition-colors flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  {importCount}개 가져오기
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 상세 모달 — document.body에 직접 마운트 */}
      {detailIdx !== null && previewRows[detailIdx] && createPortal(
        <PreviewRowDetailModal
          row={previewRows[detailIdx]}
          onClose={() => setDetailIdx(null)}
          onUpdate={(patch) => updateRow(detailIdx, patch)}
        />,
        document.body
      )}

      {mappingDetailIdx !== null && csvRows[mappingDetailIdx] && createPortal(
        <MappingRowDetailModal
          row={csvRows[mappingDetailIdx]}
          headers={csvHeaders}
          onClose={() => setMappingDetailIdx(null)}
        />,
        document.body
      )}
    </>
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
          className="w-full bg-[#2C2C2E] border border-white/[0.06] rounded-xl px-3 py-2.5 pr-8 text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40 appearance-none">
          <option value="" className="text-[#4E5968]">{optional ? '없음' : '선택'}</option>
          {headers.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
      </div>
    </div>
  )
}
