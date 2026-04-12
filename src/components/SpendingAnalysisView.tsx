import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import type { Budget, Transaction } from '../types'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../types'
import { fmt } from '../lib/format'
import {
  type PresetKey,
  type Suggestion,
  daysBetween,
  filterByRange,
  generateSuggestions,
  getPreviousPeriod,
  getPresetRange,
} from '../lib/spendingRules'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'this_month', label: '이번 달' },
  { key: 'last_month', label: '지난 달' },
  { key: 'last_30',    label: '최근 30일' },
  { key: 'last_90',    label: '최근 3개월' },
]

const PRIORITY_COLOR: Record<Suggestion['priority'], string> = {
  high:   '#F25260',
  medium: '#F5BE3A',
  low:    '#3D8EF8',
}

const PRIORITY_LABEL: Record<Suggestion['priority'], string> = {
  high:   '긴급',
  medium: '주의',
  low:    '참고',
}

export default function SpendingAnalysisView({ transactions, budgets }: Props) {
  const [preset,     setPreset]     = useState<PresetKey | null>('this_month')
  const [startDate,  setStartDate]  = useState(() => getPresetRange('this_month').start)
  const [endDate,    setEndDate]    = useState(() => getPresetRange('this_month').end)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [showCat,    setShowCat]    = useState<'category' | 'tag'>('category')
  const [simCat,     setSimCat]     = useState<string | null>(null)
  const [simPct,     setSimPct]     = useState<number>(20)
  const [copied,     setCopied]     = useState(false)

  // ── 날짜 범위 설정 ─────────────────────────────────────────
  function handlePreset(key: PresetKey) {
    const { start, end } = getPresetRange(key)
    setPreset(key)
    setStartDate(start)
    setEndDate(end)
  }

  function handleStartChange(val: string) {
    setPreset(null)
    setStartDate(val)
  }

  function handleEndChange(val: string) {
    setPreset(null)
    setEndDate(val)
  }

  const isValidRange = startDate && endDate && startDate <= endDate

  // ── 기간 데이터 계산 ───────────────────────────────────────
  const { periodTxs, prevTxs, days, totalExpense, totalIncome } = useMemo(() => {
    if (!isValidRange) {
      return { periodTxs: [], prevTxs: [], days: 0, totalExpense: 0, totalIncome: 0 }
    }
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate)
    const periodTxs   = filterByRange(transactions, startDate, endDate)
    const prevTxs     = filterByRange(transactions, prevStart, prevEnd)
    const days        = daysBetween(startDate, endDate)
    const periodExp   = periodTxs.filter((t) => t.type === 'expense')
    const totalExpense = periodExp.reduce((s, t) => s + t.amount, 0)
    const totalIncome  = periodTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    return { periodTxs, prevTxs, days, totalExpense, totalIncome }
  }, [transactions, startDate, endDate, isValidRange])

  // ── 전 기간 지출 합계 ──────────────────────────────────────
  const prevTotalExpense = useMemo(
    () => prevTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [prevTxs],
  )

  // ── 카테고리별 집계 ────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    periodTxs.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({
        cat,
        amt,
        pct: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0,
        daily: days > 0 ? Math.round(amt / days) : 0,
      }))
  }, [periodTxs, totalExpense, days])

  // ── 태그별 집계 ────────────────────────────────────────────
  const tagData = useMemo(() => {
    const map: Record<string, number> = {}
    periodTxs.filter((t) => t.type === 'expense').forEach((t) => {
      ;(t.tags ?? []).forEach((tag) => {
        map[tag] = (map[tag] || 0) + t.amount
      })
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, amt]) => ({
        tag,
        amt,
        pct: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0,
        daily: days > 0 ? Math.round(amt / days) : 0,
      }))
  }, [periodTxs, totalExpense, days])

  const hasTagData = tagData.length > 0

  // ── 전기간 대비 변화율 ─────────────────────────────────────
  const expenseDiff = prevTotalExpense > 0
    ? Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100)
    : null

  // ── 절감 제안 ─────────────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!isValidRange) return []
    return generateSuggestions(periodTxs, prevTxs, transactions, budgets, startDate, endDate)
  }, [periodTxs, prevTxs, transactions, budgets, startDate, endDate, isValidRange])

  // ── 시뮬레이터 ────────────────────────────────────────────
  const simCatData = useMemo(() => {
    if (categoryData.length === 0) return null
    const cat = simCat ?? categoryData[0].cat
    return categoryData.find((c) => c.cat === cat) ?? categoryData[0]
  }, [categoryData, simCat])

  const simSaving = simCatData ? Math.round(simCatData.amt * (simPct / 100)) : 0
  const simMonthly = days > 0 ? Math.round(simSaving / days * 30) : 0
  const simYearly  = simMonthly * 12

  // ── 결과 텍스트 복사 ──────────────────────────────────────
  function handleCopy() {
    const lines: string[] = [
      `[지출 분석] ${startDate} ~ ${endDate} (${days}일)`,
      `총 지출: ${fmt(totalExpense)}원  |  일평균: ${fmt(Math.round(totalExpense / days))}원`,
      '',
      '카테고리 분석',
      ...categoryData.map((c) => `  ${CATEGORY_EMOJI[c.cat] ?? ''} ${c.cat}: ${fmt(c.amt)}원 (${c.pct}%)`),
      '',
      '절감 제안',
      ...suggestions.map((s) => `  ${s.icon} ${s.title}`),
    ]
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── 날짜 포맷 ─────────────────────────────────────────────
  function fmtDate(ymd: string) {
    const [y, m, d] = ymd.split('-')
    return `${y}.${m}.${d}`
  }

  // ── 수입/지출 비율 바 색상 ────────────────────────────────
  const ratioColor =
    totalIncome === 0 ? '#8B95A1'
    : totalExpense / totalIncome > 0.9 ? '#F25260'
    : totalExpense / totalIncome > 0.7 ? '#F5BE3A'
    : '#3D8EF8'

  return (
    <div className="space-y-3 pb-6">

      {/* ── 기간 선택 ──────────────────────────────────────── */}
      <div className="bg-[#1E2236] rounded-3xl p-5">
        <p className="text-[15px] font-bold text-white mb-3">분석 기간</p>

        {/* 프리셋 칩 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-0.5 no-scrollbar">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                preset === p.key
                  ? 'bg-[#3D8EF8] text-white'
                  : 'bg-[#252A3F] text-[#8B95A1] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 날짜 입력 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-[#4E5968] font-semibold mb-1.5">시작일</p>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full bg-[#252A3F] text-white text-sm rounded-xl px-3 py-2.5 border border-white/[0.06] outline-none focus:border-[#3D8EF8]/60"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div>
            <p className="text-[11px] text-[#4E5968] font-semibold mb-1.5">종료일</p>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndChange(e.target.value)}
              className="w-full bg-[#252A3F] text-white text-sm rounded-xl px-3 py-2.5 border border-white/[0.06] outline-none focus:border-[#3D8EF8]/60"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      </div>

      {/* ── 날짜 미설정 시 안내 ─────────────────────────────── */}
      {!isValidRange && (
        <div className="bg-[#1E2236] rounded-3xl p-8 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm text-[#8B95A1]">분석할 기간을 선택해주세요</p>
        </div>
      )}

      {isValidRange && (
        <>
          {/* ── 요약 카드 ────────────────────────────────────── */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-bold text-white">기간 요약</p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#252A3F] text-xs text-[#8B95A1] hover:text-white transition-colors"
              >
                {copied ? <Check size={12} className="text-[#2ACF6A]" /> : <Copy size={12} />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>

            <p className="text-[11px] text-[#4E5968] mb-3">
              {fmtDate(startDate)} – {fmtDate(endDate)} ({days}일)
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#252A3F] rounded-2xl p-3.5">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1">총 지출</p>
                <p className="text-[17px] font-extrabold text-[#F25260] num">
                  {fmt(totalExpense)}<span className="text-[11px] font-medium text-[#4E5968] ml-0.5">원</span>
                </p>
                {expenseDiff !== null && (
                  <p className={`text-[11px] font-bold mt-1 num ${expenseDiff > 0 ? 'text-[#F25260]' : expenseDiff < 0 ? 'text-[#2ACF6A]' : 'text-[#4E5968]'}`}>
                    {expenseDiff > 0 ? '▲' : expenseDiff < 0 ? '▼' : '─'} 전 기간 대비 {Math.abs(expenseDiff)}%
                  </p>
                )}
              </div>
              <div className="bg-[#252A3F] rounded-2xl p-3.5">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1">일평균 지출</p>
                <p className="text-[17px] font-extrabold text-white num">
                  {fmt(days > 0 ? Math.round(totalExpense / days) : 0)}<span className="text-[11px] font-medium text-[#4E5968] ml-0.5">원</span>
                </p>
                <p className="text-[11px] text-[#4E5968] mt-1 num">
                  월 환산 {fmt(Math.round(totalExpense / days * 30))}원
                </p>
              </div>
            </div>

            {/* 지출/수입 비율 바 */}
            {totalIncome > 0 ? (
              <div>
                <div className="flex justify-between text-xs text-[#4E5968] mb-1.5">
                  <span>지출 비율</span>
                  <span className="font-bold num" style={{ color: ratioColor }}>
                    {Math.min(100, Math.round((totalExpense / totalIncome) * 100))}%
                    <span className="font-normal text-[#4E5968]">  (수입 {fmt(totalIncome)}원)</span>
                  </span>
                </div>
                <div className="h-2 bg-[#252A3F] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (totalExpense / totalIncome) * 100)}%`,
                      backgroundColor: ratioColor,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#4E5968]">수입을 기록하면 지출 비율을 볼 수 있어요</p>
            )}
          </div>

          {/* ── 카테고리 / 태그 분석 ─────────────────────────── */}
          {(categoryData.length > 0 || tagData.length > 0) && (
            <div className="bg-[#1E2236] rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[15px] font-bold text-white">카테고리 분석</p>
                {hasTagData && (
                  <div className="flex bg-[#252A3F] rounded-xl p-0.5">
                    <button
                      onClick={() => setShowCat('category')}
                      className={`px-3 py-1 rounded-[10px] text-[11px] font-bold transition-all ${
                        showCat === 'category' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968]'
                      }`}
                    >카테고리</button>
                    <button
                      onClick={() => setShowCat('tag')}
                      className={`px-3 py-1 rounded-[10px] text-[11px] font-bold transition-all ${
                        showCat === 'tag' ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968]'
                      }`}
                    >태그</button>
                  </div>
                )}
              </div>

              {showCat === 'category' ? (
                <div className="space-y-3">
                  {categoryData.map((item) => {
                    const color = CATEGORY_COLOR[item.cat]?.text ?? '#8B95A1'
                    const emoji = CATEGORY_EMOJI[item.cat] ?? '📦'
                    return (
                      <div key={item.cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{emoji}</span>
                            <span className="text-sm font-semibold text-white">{item.cat}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold num" style={{ color }}>
                              {fmt(item.amt)}원
                            </span>
                            <span className="text-[11px] text-[#4E5968] ml-1.5 num">하루 {fmt(item.daily)}원</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#252A3F] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.pct}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-[11px] text-[#4E5968] font-semibold w-8 text-right num">{item.pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {tagData.map((item) => (
                    <div key={item.tag}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-white">#{item.tag}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-[#3D8EF8] num">{fmt(item.amt)}원</span>
                          <span className="text-[11px] text-[#4E5968] ml-1.5 num">하루 {fmt(item.daily)}원</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#252A3F] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#3D8EF8] transition-all duration-500"
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#4E5968] font-semibold w-8 text-right num">{item.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 절감 제안 ────────────────────────────────────── */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">절감 제안</p>

            {suggestions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm text-[#8B95A1]">이 기간 지출은 양호해요</p>
                <p className="text-xs text-[#4E5968] mt-1">지출 내역을 더 추가하면 더 정확한 분석이 가능해요</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {suggestions.map((s) => {
                  const isOpen = expanded === s.id
                  const borderColor = PRIORITY_COLOR[s.priority]
                  return (
                    <div
                      key={s.id}
                      className="bg-[#252A3F] rounded-2xl overflow-hidden"
                      style={{ borderLeft: `3px solid ${borderColor}` }}
                    >
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                        onClick={() => setExpanded(isOpen ? null : s.id)}
                      >
                        <span className="text-xl shrink-0">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                              style={{ backgroundColor: `${borderColor}20`, color: borderColor }}
                            >
                              {PRIORITY_LABEL[s.priority]}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white leading-snug">{s.title}</p>
                        </div>
                        {isOpen
                          ? <ChevronUp size={16} className="text-[#4E5968] shrink-0" />
                          : <ChevronDown size={16} className="text-[#4E5968] shrink-0" />
                        }
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2">
                          <p className="text-sm text-[#8B95A1] leading-relaxed">{s.body}</p>
                          {s.savingHint && (
                            <div className="flex items-center gap-2 bg-[#1E2236] rounded-xl px-3 py-2">
                              <span className="text-base">💡</span>
                              <p className="text-xs font-semibold text-[#F5BE3A]">{s.savingHint}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 절약 시뮬레이터 ──────────────────────────────── */}
          {categoryData.length > 0 && (
            <div className="bg-[#1E2236] rounded-3xl p-5">
              <p className="text-[15px] font-bold text-white mb-1">절약 시뮬레이터</p>
              <p className="text-xs text-[#4E5968] mb-4">특정 카테고리를 줄이면 얼마나 절약할 수 있는지 계산해요</p>

              {/* 카테고리 선택 */}
              <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
                {categoryData.slice(0, 6).map((item) => {
                  const isSelected = (simCat ?? categoryData[0].cat) === item.cat
                  const color = CATEGORY_COLOR[item.cat]?.text ?? '#8B95A1'
                  return (
                    <button
                      key={item.cat}
                      onClick={() => setSimCat(item.cat)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        isSelected ? 'text-white' : 'bg-[#252A3F] text-[#4E5968] border-transparent'
                      }`}
                      style={isSelected ? { backgroundColor: `${color}25`, borderColor: color, color } : {}}
                    >
                      <span>{CATEGORY_EMOJI[item.cat] ?? '📦'}</span>
                      {item.cat}
                    </button>
                  )
                })}
              </div>

              {/* 절감 % 선택 */}
              <div className="flex gap-2 mb-4">
                {[10, 20, 30, 50].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setSimPct(pct)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      simPct === pct ? 'bg-[#3D8EF8] text-white' : 'bg-[#252A3F] text-[#4E5968]'
                    }`}
                  >
                    -{pct}%
                  </button>
                ))}
              </div>

              {/* 결과 */}
              {simCatData && (
                <div className="bg-[#252A3F] rounded-2xl p-4 space-y-3">
                  <p className="text-sm text-[#8B95A1]">
                    {CATEGORY_EMOJI[simCatData.cat] ?? '📦'} <span className="text-white font-semibold">{simCatData.cat}</span>을(를){' '}
                    <span className="text-[#3D8EF8] font-bold">{simPct}%</span> 줄인다면...
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-[#4E5968] font-semibold mb-1">기간 절감</p>
                      <p className="text-sm font-extrabold text-[#2ACF6A] num">{fmt(simSaving)}원</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#4E5968] font-semibold mb-1">월 환산</p>
                      <p className="text-sm font-extrabold text-[#2ACF6A] num">{fmt(simMonthly)}원</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#4E5968] font-semibold mb-1">연 환산</p>
                      <p className="text-sm font-extrabold text-[#2ACF6A] num">{fmt(simYearly)}원</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
