import { useState, useEffect, useCallback } from 'react'
import { fetchChart, RANGE_CONFIG } from '../lib/stockPriceApi'
import type { ChartRange, StockChartData } from '../lib/stockPriceApi'

export default function useStockChart(ticker: string, range: ChartRange) {
  const [chartData, setChartData] = useState<StockChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchChart(ticker, range)
      setChartData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '차트 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [ticker, range])

  useEffect(() => {
    load()
    const id = setInterval(load, RANGE_CONFIG[range].pollMs)
    return () => clearInterval(id)
  }, [load, range])

  return { chartData, loading, error }
}
