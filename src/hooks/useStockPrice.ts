import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchQuotes } from '../lib/stockPriceApi'
import type { StockQuote } from '../lib/stockPriceApi'

/** 폴링 간격: 30초 */
const POLL_INTERVAL_MS = 30_000

export interface UseStockPriceResult {
  prices: Record<string, StockQuote>
  loading: boolean
  error: string | null
  lastUpdated: number | null
  refresh: () => void
}

/**
 * 주어진 티커 목록의 실시간 시세를 30초 간격으로 폴링하는 훅
 *
 * @param tickers - 시세를 조회할 티커 배열 (예: ['005930', 'AAPL', '035420.KQ'])
 * @returns prices, loading, error, lastUpdated, refresh
 */
export default function useStockPrice(tickers: string[]): UseStockPriceResult {
  const [prices, setPrices] = useState<Record<string, StockQuote>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  // tickers 변경 시 ref에 최신값 유지 (interval 콜백에서 사용)
  const tickersRef = useRef<string[]>(tickers)
  useEffect(() => {
    tickersRef.current = tickers
  }, [tickers])

  const refresh = useCallback(async () => {
    const ts = tickersRef.current
    if (ts.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const quotes = await fetchQuotes(ts)
      setPrices(prev => ({ ...prev, ...quotes }))
      setLastUpdated(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : '시세 조회 실패')
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
      return
    }

    refresh()
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey, refresh])

  return { prices, loading, error, lastUpdated, refresh }
}
