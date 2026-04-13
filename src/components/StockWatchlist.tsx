import { useMemo, useState, useRef } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import type { StockTrade, StockQuote } from '../types'
import { calcHoldings } from '../lib/stockCalc'
import { fmt, fmtQty, fmtPrice } from '../lib/format'
import { searchStocks, type StockSearchResult } from '../lib/stockPriceApi'

interface Props {
  trades: StockTrade[]
  watchlist: string[]
  prices?: Record<string, StockQuote>
  onAdd: (ticker: string) => void
  onRemove: (ticker: string) => void
}

const TICKER_RE = /^(\d{6}(\.[A-Z]{2})?|[A-Z0-9]{1,7}(\.[A-Z]{1,2})?)$/

function validateTicker(raw: string): string | null {
  if (/[^\x00-\x7F]/.test(raw)) return '한글/특수문자는 입력할 수 없어요. 종목코드를 입력하세요 (예: 005930, AAPL)'
  if (!TICKER_RE.test(raw)) return '올바른 종목코드 형식이 아니에요 (예: 005930, 035420.KQ, AAPL)'
  return null
}

export default function StockWatchlist({ trades, watchlist, prices = {}, onAdd, onRemove }: Props) {
  const [inputTicker, setInputTicker] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdings = useMemo(() => calcHoldings(trades), [trades])

  const watchItems = useMemo(() => {
    return watchlist.map((ticker) => {
      const h = holdings.find((item) => item.ticker === ticker)
      const tradeCount = trades.filter((t) => t.ticker === ticker).length
      const quote = prices[ticker] ?? null
      return { ticker, holding: h ?? null, tradeCount, quote }
    })
  }, [holdings, trades, watchlist, prices])

  function handleAdd() {
    const ticker = inputTicker.trim().toUpperCase()
    if (!ticker) return
    const err = validateTicker(ticker)
    if (err) { setInputError(err); return }
    setInputError(null)
    onAdd(ticker)
    setInputTicker('')
    setSuggestions([])
  }

  function handleSelectSuggestion(s: StockSearchResult) {
    onAdd(s.symbol)
    setInputTicker('')
    setSuggestions([])
    setInputError(null)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputTicker(val)
    setInputError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = val.trim()

    if (trimmed.length < 2) { setSuggestions([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchStocks(trimmed)
        setSuggestions(results)
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  return (
    <div className="space-y-3 tab-content">
      <div className="bg-[#1E2236] rounded-2xl p-3">
        <p className="text-sm font-bold text-white mb-2">관심종목 추가</p>
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputTicker}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAdd()
                }
                if (e.key === 'Escape') {
                  setSuggestions([])
                }
              }}
              placeholder="종목명 또는 코드 (예: SK하이닉스, AAPL)"
              className="flex-1 bg-[#252A3F] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="w-10 h-10 rounded-xl bg-[#F5BE3A] text-[#0D0F14] flex items-center justify-center font-bold shrink-0"
              aria-label="관심종목 추가"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* 자동완성 드롭다운 */}
          {suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-10 mt-1 bg-[#252A3F] rounded-xl overflow-hidden z-10 shadow-lg border border-white/[0.06]">
              {suggestions.map((s) => (
                <li
                  key={s.symbol}
                  onMouseDown={(e) => e.preventDefault()} // input blur 방지
                  onClick={() => handleSelectSuggestion(s)}
                  className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-[#1E2236] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.shortName}</p>
                    <p className="text-[10px] text-[#8B95A1]">{s.symbol}</p>
                  </div>
                  <span className="text-[10px] text-[#4E5968] shrink-0 ml-2">{s.quoteType}</span>
                </li>
              ))}
            </ul>
          )}

          {searching && suggestions.length === 0 && (
            <p className="absolute top-full left-0 mt-1 text-[11px] text-[#8B95A1] px-1">검색 중...</p>
          )}
        </div>

        {inputError ? (
          <p className="text-[10px] text-[#F25260] mt-2">{inputError}</p>
        ) : (
          <p className="text-[10px] text-[#4E5968] mt-2">
            종목명으로 검색하거나 코드를 직접 입력하세요 (예: 005930 → KOSPI, 035420.KQ → KOSDAQ)
          </p>
        )}
      </div>

      {watchItems.length === 0 ? (
        <div className="bg-[#1E2236] rounded-3xl p-10 text-center">
          <p className="text-4xl mb-3">⭐</p>
          <p className="font-bold text-white text-[15px]">관심종목이 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">종목을 추가해 빠르게 모아보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {watchItems.map((item) => {
            const { quote } = item
            const currency = quote?.currency ?? 'KRW'
            const isUp = quote ? quote.changePct >= 0 : null

            return (
              <div key={item.ticker} className="bg-[#1E2236] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F5BE3A]/15 flex items-center justify-center shrink-0">
                    <Star size={16} className="text-[#F5BE3A]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white truncate">{item.ticker}</p>
                      {quote?.shortName && item.ticker !== quote.shortName && (
                        <p className="text-[10px] text-[#4E5968] truncate hidden sm:block">{quote.shortName}</p>
                      )}
                    </div>
                    {item.holding ? (
                      <p className="text-[11px] text-[#8B95A1]">보유 {fmtQty(item.holding.quantity)}주 · 원가 {fmt(item.holding.totalCost)}원</p>
                    ) : (
                      <p className="text-[11px] text-[#4E5968]">보유 없음{item.tradeCount > 0 ? ` · 거래 ${item.tradeCount}건` : ''}</p>
                    )}
                  </div>

                  {/* 현재가 / 등락 */}
                  <div className="text-right shrink-0">
                    {quote ? (
                      <>
                        <p className="text-sm font-bold text-white num">{fmtPrice(quote.currentPrice, currency)}</p>
                        <p className={`text-[11px] font-semibold ${isUp ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                          {isUp ? '▲' : '▼'} {Math.abs(quote.changePct).toFixed(2)}%
                          <span className="ml-1 text-[10px]">({isUp ? '+' : ''}{fmtPrice(quote.change, currency)})</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-[#4E5968]">시세 없음</p>
                    )}
                  </div>

                  <button
                    onClick={() => onRemove(item.ticker)}
                    className="w-7 h-7 rounded-lg bg-[#252A3F] flex items-center justify-center text-[#8B95A1] hover:text-[#F25260] transition-colors shrink-0"
                    aria-label={`${item.ticker} 삭제`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* 미실현 손익 (보유 + 가격 데이터 있을 때) */}
                {item.holding && quote && (
                  <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between">
                    <p className="text-[10px] text-[#4E5968]">
                      평가금액 {fmtPrice(quote.currentPrice * item.holding.quantity, currency)}
                    </p>
                    {(() => {
                      const unrealizedPnL = quote.currentPrice * item.holding.quantity - item.holding.totalCost
                      const unrealizedPct = item.holding.totalCost > 0 ? (unrealizedPnL / item.holding.totalCost) * 100 : 0
                      const color = unrealizedPnL > 0 ? 'text-[#2ACF6A]' : unrealizedPnL < 0 ? 'text-[#F25260]' : 'text-[#8B95A1]'
                      return (
                        <p className={`text-[10px] font-semibold num ${color}`}>
                          평가손익 {unrealizedPnL >= 0 ? '+' : ''}{fmtPrice(unrealizedPnL, currency)}
                          <span className="ml-1">({unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%)</span>
                        </p>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
