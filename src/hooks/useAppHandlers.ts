import { useCallback } from 'react'
import type { Dispatch } from 'react'
import type { Transaction, Memo, Budget, RecurringTransaction, TransactionType, StockTrade, Subscription, SavingsGoal } from '../types'
import { saveBudgets, saveMemos, saveRecurring, saveSettings, saveStockTrades, saveSubscriptions, saveGoals, saveTransactions, loadSettings } from '../lib/storage'
import { generateId } from '../lib/format'
import { showToast } from '../lib/toast'
import { auth } from '../firebase/firebase'
import { deleteReceiptImage } from '../lib/receiptStorage'
import type { UIAction } from './useAppHandlers.types'

export type { UIAction }

interface HandlersInput {
  transactions: Transaction[]
  editingTransaction: Transaction | null
  editingTrade: StockTrade | null
  yearMonth: string
  persist: (task: Promise<void>, failMsg: string) => void
  setTransactions: Dispatch<React.SetStateAction<Transaction[]>>
  setStockTrades: Dispatch<React.SetStateAction<StockTrade[]>>
  setBudgets: Dispatch<React.SetStateAction<Budget[]>>
  setRecurring: Dispatch<React.SetStateAction<RecurringTransaction[]>>
  setSubscriptions: Dispatch<React.SetStateAction<Subscription[]>>
  setGoals: Dispatch<React.SetStateAction<SavingsGoal[]>>
  setMemos: Dispatch<React.SetStateAction<Memo[]>>
  setStockWatchlist: Dispatch<React.SetStateAction<string[]>>
  setCustomExpenseCategories: Dispatch<React.SetStateAction<string[]>>
  setCustomIncomeCategories: Dispatch<React.SetStateAction<string[]>>
  dispatchUI: Dispatch<UIAction>
}

export function useAppHandlers({
  transactions,
  editingTransaction,
  editingTrade,
  yearMonth,
  persist,
  setTransactions,
  setStockTrades,
  setBudgets,
  setRecurring,
  setSubscriptions,
  setGoals,
  setMemos,
  setStockWatchlist,
  setCustomExpenseCategories,
  setCustomIncomeCategories,
  dispatchUI,
}: HandlersInput) {
  const handleSaveTransaction = useCallback(
    (items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
      setTransactions((prev) => {
        let next = prev
        if (editingTransaction && items.length > 0) {
          next = prev.map((t) => t.id === editingTransaction.id ? { ...t, ...items[0] } : t)
          const extra = items.slice(1).map((d) => ({ ...d, id: generateId(), createdAt: Date.now() }))
          next = [...next, ...extra]
        } else {
          next = [...prev, ...items.map((d) => ({ ...d, id: generateId(), createdAt: Date.now() }))]
        }
        persist(saveTransactions(next), '거래 저장에 실패했습니다.')
        return next
      })
      dispatchUI({ type: 'CLOSE_TX_MODAL' })
    },
    [editingTransaction, persist, setTransactions, dispatchUI]
  )

  const handleDeleteTransaction = useCallback((id: string) => {
    if (!confirm('이 내역을 삭제할까요?')) return
    setTransactions((prev) => {
      const transaction = prev.find((t) => t.id === id)
      if (transaction?.receiptImageUrl && auth.currentUser) {
        void deleteReceiptImage(auth.currentUser.uid, id).catch((e) => {
          console.error('Failed to delete receipt image:', e)
        })
      }
      const next = prev.filter((t) => t.id !== id)
      persist(saveTransactions(next), '거래 삭제 저장에 실패했습니다.')
      return next
    })
  }, [persist, setTransactions])

  const handleTransactionArchive = useCallback((cutoff: string) => {
    setTransactions((prev) => prev.filter(t => t.date >= cutoff))
  }, [setTransactions])

  const handleBulkImport = useCallback((items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    setTransactions((prev) => {
      const next = [...prev, ...items.map((item) => ({ ...item, id: generateId(), createdAt: Date.now() }))]
      persist(saveTransactions(next), '가져오기 저장에 실패했습니다.')
      return next
    })
  }, [persist, setTransactions])

  const handleSaveStockTrade = useCallback((data: Omit<StockTrade, 'id' | 'createdAt'>) => {
    setStockTrades((prev) => {
      const next = editingTrade
        ? prev.map((t) => t.id === editingTrade.id ? { ...t, ...data } : t)
        : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
      persist(saveStockTrades(next), '주식 거래 저장에 실패했습니다.')
      return next
    })
    dispatchUI({ type: 'CLOSE_STOCK_MODAL' })
  }, [editingTrade, persist, setStockTrades, dispatchUI])

  const handleDeleteStockTrade = useCallback((id: string) => {
    if (!confirm('이 거래를 삭제할까요?')) return
    setStockTrades((prev) => {
      const next = prev.filter((t) => t.id !== id)
      persist(saveStockTrades(next), '주식 거래 삭제에 실패했습니다.')
      return next
    })
  }, [persist, setStockTrades])

  const handleBudgetsChange = useCallback((b: Budget[]) => {
    setBudgets(b)
    persist(saveBudgets(b), '예산 저장에 실패했습니다.')
  }, [persist, setBudgets])

  const handleRecurringSave = useCallback((items: RecurringTransaction[]) => {
    setRecurring(items)
    persist(saveRecurring(items), '정기내역 저장에 실패했습니다.')
  }, [persist, setRecurring])

  const handleSubscriptionsChange = useCallback((items: Subscription[]) => {
    setSubscriptions(items)
    persist(saveSubscriptions(items), '구독 저장에 실패했습니다.')
  }, [persist, setSubscriptions])

  const handleGoalsChange = useCallback((items: SavingsGoal[]) => {
    setGoals(items)
    persist(saveGoals(items), '목표 저장에 실패했습니다.')
  }, [persist, setGoals])

  const handleApplyRecurring = useCallback(async (pending: RecurringTransaction[]) => {
    const newTx: Transaction[] = pending.map((r) => ({
      id: generateId(),
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      date: `${yearMonth}-${String(r.dayOfMonth).padStart(2, '0')}`,
      createdAt: Date.now(),
    }))
    const newTxIds = new Set(newTx.map((t) => t.id))
    const nextTxs = [...transactions, ...newTx]
    setTransactions(nextTxs)
    try {
      await saveTransactions(nextTxs)
    } catch (e) {
      console.error('[handleApplyRecurring] 거래 저장 실패', e)
      showToast('정기내역 적용 저장에 실패했습니다.')
      setTransactions((prev) => prev.filter((t) => !newTxIds.has(t.id)))
      return
    }
    setRecurring((prev) => {
      const ids = new Set(pending.map((r) => r.id))
      const next = prev.map((r) => ids.has(r.id) ? { ...r, lastAppliedMonth: yearMonth } : r)
      persist(saveRecurring(next), '정기내역 상태 저장에 실패했습니다.')
      return next
    })
  }, [transactions, persist, yearMonth, setTransactions, setRecurring])

  const handleSaveCategories = useCallback((expense: string[], income: string[]) => {
    setCustomExpenseCategories(expense)
    setCustomIncomeCategories(income)
    persist(
      (async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, customExpenseCategories: expense, customIncomeCategories: income })
      })(),
      '카테고리 저장에 실패했습니다.'
    )
  }, [persist, setCustomExpenseCategories, setCustomIncomeCategories])

  const handleAddWatchTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase()
    if (!normalized) return
    setStockWatchlist((prev) => {
      if (prev.includes(normalized)) return prev
      const next = [...prev, normalized]
      persist(
        (async () => {
          const current = await loadSettings()
          await saveSettings({ ...current, stockWatchlist: next })
        })(),
        '관심종목 저장에 실패했습니다.'
      )
      return next
    })
  }, [persist, setStockWatchlist])

  const handleRemoveWatchTicker = useCallback((ticker: string) => {
    setStockWatchlist((prev) => {
      const next = prev.filter((item) => item !== ticker)
      persist(
        (async () => {
          const current = await loadSettings()
          await saveSettings({ ...current, stockWatchlist: next })
        })(),
        '관심종목 저장에 실패했습니다.'
      )
      return next
    })
  }, [persist, setStockWatchlist])

  const handleAddMemo = useCallback((title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => {
    setMemos((prev) => {
      const now = Date.now()
      const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now, date, dateEnd, amount, transactionType, category }]
      persist(saveMemos(next), '메모 저장에 실패했습니다.')
      return next
    })
  }, [persist, setMemos])

  const handleUpdateMemo = useCallback((id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now(), date, dateEnd, amount, transactionType, category } : m)
      persist(saveMemos(next), '메모 수정 저장에 실패했습니다.')
      return next
    })
  }, [persist, setMemos])

  const handleDeleteMemo = useCallback((id: string) => {
    if (!confirm('이 메모를 삭제할까요?')) return
    setMemos((prev) => {
      const next = prev.filter((m) => m.id !== id)
      persist(saveMemos(next), '메모 삭제 저장에 실패했습니다.')
      return next
    })
  }, [persist, setMemos])

  const handleTogglePin = useCallback((id: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m)
      persist(saveMemos(next), '메모 고정 상태 저장에 실패했습니다.')
      return next
    })
  }, [persist, setMemos])

  return {
    handleSaveTransaction,
    handleDeleteTransaction,
    handleTransactionArchive,
    handleBulkImport,
    handleSaveStockTrade,
    handleDeleteStockTrade,
    handleBudgetsChange,
    handleRecurringSave,
    handleSubscriptionsChange,
    handleGoalsChange,
    handleApplyRecurring,
    handleSaveCategories,
    handleAddWatchTicker,
    handleRemoveWatchTicker,
    handleAddMemo,
    handleUpdateMemo,
    handleDeleteMemo,
    handleTogglePin,
  }
}
