import { useState, useCallback } from 'react'
import type { StockTrade } from '../types'
import { loadStockTrades, saveStockTrades } from '../lib/storage'
import { generateId } from '../lib/format'

export function useStockTrades() {
  const [stockTrades, setStockTrades] = useState<StockTrade[]>(() => loadStockTrades())

  const saveStockTrade = useCallback(
    (data: Omit<StockTrade, 'id' | 'createdAt'>, editing: StockTrade | null) => {
      setStockTrades((prev) => {
        const next = editing
          ? prev.map((t) => t.id === editing.id ? { ...t, ...data } : t)
          : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
        saveStockTrades(next)
        return next
      })
    },
    []
  )

  const deleteStockTrade = useCallback((id: string) => {
    if (!confirm('이 거래를 삭제할까요?')) return
    setStockTrades((prev) => { const next = prev.filter((t) => t.id !== id); saveStockTrades(next); return next })
  }, [])

  return { stockTrades, setStockTrades, saveStockTrade, deleteStockTrade }
}
