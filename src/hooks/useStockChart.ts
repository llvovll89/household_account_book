import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchChart, RANGE_CONFIG } from '../lib/stockPriceApi'
import type { ChartRange, StockChartData } from '../lib/stockPriceApi'

export default function useStockChart(ticker: string, range: ChartRange) {
  const [chartData, setChartData] = useState<StockChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!ticker) return
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchChart(ticker, range)
      if (requestId !== requestIdRef.current) return // ticker/range가 바뀌어 이 응답은 더 이상 최신이 아님
      setChartData(data)
    } catch (e) {
      if (requestId !== requestIdRef.current) return
      setError(e instanceof Error ? e.message : '차트 로드 실패')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [ticker, range])

  useEffect(() => {
    load()
    const id = setInterval(load, RANGE_CONFIG[range].pollMs)
    return () => clearInterval(id)
  }, [load, range])

  return { chartData, loading, error }
}
