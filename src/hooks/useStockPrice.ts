import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchQuotes } from '../lib/stockPriceApi'
import type { StockQuote } from '../lib/stockPriceApi'

/** 장중 폴링 간격: 30초 */
const POLL_INTERVAL_REGULAR_MS = 30_000
/** 장외(CLOSED/PRE/POST) 폴링 간격: 5분 */
const POLL_INTERVAL_CLOSED_MS  = 5 * 60_000

function getMarketState(prices: Record<string, StockQuote>): string {
  const states = Object.values(prices).map(q => q.marketState)
  if (states.includes('REGULAR')) return 'REGULAR'
  if (states.includes('PRE') || states.includes('POST')) return 'PRE'
  return 'CLOSED'
}

export interface UseStockPriceResult {
  prices: Record<string, StockQuote>
  loading: boolean
  error: string | null
  isStale: boolean         // true면 캐시 만료 후 재요청 실패한 stale 데이터
  lastUpdated: number | null
  refresh: () => void
}

/**
 * 주어진 티커 목록의 실시간 시세를 폴링하는 훅.
 * - 장중(REGULAR): 30초 간격
 * - 장외(CLOSED): 5분 간격
 * - 모든 프록시 실패 시 stale 캐시 데이터 유지 (최대 30분)
 *
 * @param tickers - 시세를 조회할 티커 배열 (예: ['005930', 'AAPL', '035420.KQ'])
 */
export default function useStockPrice(tickers: string[]): UseStockPriceResult {
  const [prices, setPrices] = useState<Record<string, StockQuote>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const tickersRef = useRef<string[]>(tickers)
  const pricesRef  = useRef<Record<string, StockQuote>>(prices)
  useEffect(() => { tickersRef.current = tickers }, [tickers])
  useEffect(() => { pricesRef.current  = prices  }, [prices])

  const refresh = useCallback(async () => {
    const ts = tickersRef.current
    if (ts.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const quotes = await fetchQuotes(ts)
      const isFromStale = Object.values(quotes).some(
        q => Date.now() - q.lastUpdated > 60_000,
      )
      setPrices(prev => ({ ...prev, ...quotes }))
      setIsStale(isFromStale)
      setLastUpdated(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : '시세 조회 실패')
      // 이전 prices 유지 (실패해도 화면 클리어하지 않음)
    } finally {
      setLoading(false)
    }
  }, [])

  // tickers가 바뀔 때마다 즉시 fetch + 폴링 재설정
  const tickersKey = [...tickers].sort().join(',')
  useEffect(() => {
    if (tickers.length === 0) {
      setPrices({})
      setError(null)
      setIsStale(false)
      return
    }

    let timerId: ReturnType<typeof setTimeout>

    const schedule = () => {
      const state = getMarketState(pricesRef.current)
      const interval = state === 'REGULAR' ? POLL_INTERVAL_REGULAR_MS : POLL_INTERVAL_CLOSED_MS
      timerId = setTimeout(async () => {
        await refresh()
        schedule()
      }, interval)
    }

    refresh().then(schedule)

    return () => clearTimeout(timerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey, refresh])

  return { prices, loading, error, isStale, lastUpdated, refresh }
}
