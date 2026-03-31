import { useState, useCallback } from 'react'
import type { Transaction } from '../types'
import { loadTransactions, saveTransactions } from '../lib/storage'
import { generateId } from '../lib/format'

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions())

  const saveTransaction = useCallback(
    (data: Omit<Transaction, 'id' | 'createdAt'>, editing: Transaction | null) => {
      setTransactions((prev) => {
        const next = editing
          ? prev.map((t) => t.id === editing.id ? { ...t, ...data } : t)
          : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
        saveTransactions(next)
        return next
      })
    },
    []
  )

  const deleteTransaction = useCallback((id: string) => {
    if (!confirm('이 내역을 삭제할까요?')) return
    setTransactions((prev) => { const next = prev.filter((t) => t.id !== id); saveTransactions(next); return next })
  }, [])

  const bulkImport = useCallback((items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    setTransactions((prev) => {
      const next = [...prev, ...items.map((item) => ({ ...item, id: generateId(), createdAt: Date.now() }))]
      saveTransactions(next)
      return next
    })
  }, [])

  return { transactions, setTransactions, saveTransaction, deleteTransaction, bulkImport }
}
