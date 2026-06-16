import { useCallback } from 'react'
import type { Dispatch } from 'react'
import type { AutoCategoryRule, DashboardWidgetId, Transaction, Memo, Budget, RecurringTransaction, TransactionType, StockTrade, Subscription, SavingsGoal, UserPaymentMethod, TransactionTemplate } from '../types'
import type { RemoteVersionKey } from '../lib/storage'
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
  persist: (task: () => Promise<void>, failMsg: string, scope: RemoteVersionKey) => void
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
  setUserPaymentMethods: Dispatch<React.SetStateAction<UserPaymentMethod[]>>
  setTransactionTemplates: Dispatch<React.SetStateAction<TransactionTemplate[]>>
  setAutoCategoryRules: Dispatch<React.SetStateAction<AutoCategoryRule[]>>
  setHiddenWidgets: Dispatch<React.SetStateAction<DashboardWidgetId[]>>
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
  setUserPaymentMethods,
  setTransactionTemplates,
  setAutoCategoryRules,
  setHiddenWidgets,
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
        persist(() => saveTransactions(next), '거래 저장에 실패했습니다.', 'transactions')
        return next
      })
      dispatchUI({ type: 'CLOSE_TX_MODAL' })
    },
    [editingTransaction, persist, setTransactions, dispatchUI]
  )

  const handleDeleteTransaction = useCallback((id: string) => {
    dispatchUI({
      type: 'OPEN_CONFIRM',
      message: '이 내역을 삭제할까요?',
      onConfirm: () => {
        setTransactions((prev) => {
          const transaction = prev.find((t) => t.id === id)
          if (transaction?.receiptImageUrl && auth.currentUser) {
            void deleteReceiptImage(auth.currentUser.uid, id).catch((e) => {
              console.error('Failed to delete receipt image:', e)
            })
          }
          const next = prev.filter((t) => t.id !== id)
          persist(() => saveTransactions(next), '거래 삭제 저장에 실패했습니다.', 'transactions')
          return next
        })
      },
    })
  }, [persist, setTransactions, dispatchUI])

  const handleTransactionArchive = useCallback((cutoff: string) => {
    setTransactions((prev) => {
      const next = prev.filter(t => t.date >= cutoff)
      persist(() => saveTransactions(next), '아카이브 저장에 실패했습니다.', 'transactions')
      return next
    })
  }, [setTransactions, persist])

  const handleBulkEditTransactions = useCallback((ids: string[], category: string) => {
    const idSet = new Set(ids)
    setTransactions((prev) => {
      const next = prev.map((t) => idSet.has(t.id) ? { ...t, category } : t)
      persist(() => saveTransactions(next), '일괄 카테고리 변경에 실패했습니다.', 'transactions')
      return next
    })
    showToast(`${ids.length}개 내역의 카테고리를 변경했어요`, 2000, 'success')
  }, [persist, setTransactions])

  const handleBulkDeleteTransactions = useCallback((ids: string[]) => {
    dispatchUI({
      type: 'OPEN_CONFIRM',
      message: `선택한 ${ids.length}개 내역을 삭제할까요?`,
      onConfirm: () => {
        const idSet = new Set(ids)
        setTransactions((prev) => {
          prev.filter((t) => idSet.has(t.id) && t.receiptImageUrl && auth.currentUser).forEach((t) => {
            void deleteReceiptImage(auth.currentUser!.uid, t.id).catch((e) => console.error('Failed to delete receipt image:', e))
          })
          const next = prev.filter((t) => !idSet.has(t.id))
          persist(() => saveTransactions(next), '일괄 삭제 저장에 실패했습니다.', 'transactions')
          return next
        })
      },
    })
  }, [persist, setTransactions, dispatchUI])

  const handleBulkImport = useCallback((items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    setTransactions((prev) => {
      const next = [...prev, ...items.map((item) => ({ ...item, id: generateId(), createdAt: Date.now() }))]
      persist(() => saveTransactions(next), '가져오기 저장에 실패했습니다.', 'transactions')
      return next
    })
  }, [persist, setTransactions])

  const handleSaveStockTrade = useCallback((data: Omit<StockTrade, 'id' | 'createdAt'>) => {
    setStockTrades((prev) => {
      const next = editingTrade
        ? prev.map((t) => t.id === editingTrade.id ? { ...t, ...data } : t)
        : [...prev, { ...data, id: generateId(), createdAt: Date.now() }]
      persist(() => saveStockTrades(next), '주식 거래 저장에 실패했습니다.', 'stockTrades')
      return next
    })
    dispatchUI({ type: 'CLOSE_STOCK_MODAL' })
  }, [editingTrade, persist, setStockTrades, dispatchUI])

  const handleDeleteStockTrade = useCallback((id: string) => {
    dispatchUI({
      type: 'OPEN_CONFIRM',
      message: '이 거래를 삭제할까요?',
      onConfirm: () => {
        setStockTrades((prev) => {
          const next = prev.filter((t) => t.id !== id)
          persist(() => saveStockTrades(next), '주식 거래 삭제에 실패했습니다.', 'stockTrades')
          return next
        })
      },
    })
  }, [persist, setStockTrades, dispatchUI])

  const handleBudgetsChange = useCallback((b: Budget[]) => {
    setBudgets(b)
    persist(() => saveBudgets(b), '예산 저장에 실패했습니다.', 'budgets')
  }, [persist, setBudgets])

  const handleRecurringSave = useCallback((items: RecurringTransaction[]) => {
    setRecurring(items)
    persist(() => saveRecurring(items), '정기내역 저장에 실패했습니다.', 'recurring')
  }, [persist, setRecurring])

  const handleSubscriptionsChange = useCallback((items: Subscription[]) => {
    setSubscriptions(items)
    persist(() => saveSubscriptions(items), '구독 저장에 실패했습니다.', 'subscriptions')
  }, [persist, setSubscriptions])

  const handleGoalsChange = useCallback((items: SavingsGoal[]) => {
    setGoals(items)
    persist(() => saveGoals(items), '목표 저장에 실패했습니다.', 'goals')
  }, [persist, setGoals])

  const handleApplyRecurring = useCallback(async (pending: RecurringTransaction[], targetYM?: string) => {
    const ym = targetYM ?? yearMonth
    const newTx: Transaction[] = pending.map((r) => ({
      id: generateId(),
      type: r.type,
      amount: r.amount,
      paymentMethod: 'cash',
      category: r.category,
      description: r.description,
      date: `${ym}-${String(r.dayOfMonth).padStart(2, '0')}`,
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
      const next = prev.map((r) => ids.has(r.id) ? { ...r, lastAppliedMonth: ym } : r)
      persist(() => saveRecurring(next), '정기내역 상태 저장에 실패했습니다.', 'recurring')
      return next
    })
  }, [transactions, persist, yearMonth, setTransactions, setRecurring])

  const handleSavePaymentMethods = useCallback((methods: UserPaymentMethod[]) => {
    setUserPaymentMethods(methods)
    persist(
      async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, userPaymentMethods: methods })
      },
      '결제수단 저장에 실패했습니다.',
      'settings'
    )
  }, [persist, setUserPaymentMethods])

  const handleSaveTemplates = useCallback((templates: TransactionTemplate[]) => {
    setTransactionTemplates(templates)
    persist(
      async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, transactionTemplates: templates })
      },
      '템플릿 저장에 실패했습니다.',
      'settings'
    )
  }, [persist, setTransactionTemplates])

  const handleSaveAutoCategoryRules = useCallback((rules: AutoCategoryRule[]) => {
    setAutoCategoryRules(rules)
    persist(
      async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, autoCategoryRules: rules })
      },
      '자동 분류 규칙 저장에 실패했습니다.',
      'settings'
    )
  }, [persist, setAutoCategoryRules])

  const handleRenameTag = useCallback((oldName: string, newName: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.tags?.includes(oldName)
          ? { ...t, tags: t.tags.map((tag) => (tag === oldName ? newName : tag)) }
          : t
      )
    )
    persist(
      async () => {
        const { loadTransactions, saveTransactions } = await import('../lib/storage')
        const current = await loadTransactions()
        const updated = current.map((t) =>
          t.tags?.includes(oldName)
            ? { ...t, tags: t.tags.map((tag: string) => (tag === oldName ? newName : tag)) }
            : t
        )
        await saveTransactions(updated)
      },
      '태그 이름 변경에 실패했습니다.',
      'transactions'
    )
  }, [persist, setTransactions])

  const handleDeleteTag = useCallback((name: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.tags?.includes(name)
          ? { ...t, tags: t.tags.filter((tag) => tag !== name) }
          : t
      )
    )
    persist(
      async () => {
        const { loadTransactions, saveTransactions } = await import('../lib/storage')
        const current = await loadTransactions()
        const updated = current.map((t) =>
          t.tags?.includes(name)
            ? { ...t, tags: t.tags.filter((tag: string) => tag !== name) }
            : t
        )
        await saveTransactions(updated)
      },
      '태그 삭제에 실패했습니다.',
      'transactions'
    )
  }, [persist, setTransactions])

  const handleSaveHiddenWidgets = useCallback((hidden: DashboardWidgetId[]) => {
    setHiddenWidgets(hidden)
    persist(
      async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, hiddenWidgets: hidden })
      },
      '위젯 설정 저장에 실패했습니다.',
      'settings'
    )
  }, [persist, setHiddenWidgets])

  const handleSaveCategories = useCallback((expense: string[], income: string[]) => {
    setCustomExpenseCategories(expense)
    setCustomIncomeCategories(income)
    persist(
      async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, customExpenseCategories: expense, customIncomeCategories: income })
      },
      '카테고리 저장에 실패했습니다.',
      'settings'
    )
  }, [persist, setCustomExpenseCategories, setCustomIncomeCategories])

  const handleAddWatchTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase()
    if (!normalized) return
    setStockWatchlist((prev) => {
      if (prev.includes(normalized)) return prev
      const next = [...prev, normalized]
      persist(
        async () => {
          const current = await loadSettings()
          await saveSettings({ ...current, stockWatchlist: next })
        },
        '관심종목 저장에 실패했습니다.',
        'settings'
      )
      return next
    })
  }, [persist, setStockWatchlist])

  const handleRemoveWatchTicker = useCallback((ticker: string) => {
    setStockWatchlist((prev) => {
      const next = prev.filter((item) => item !== ticker)
      persist(
        async () => {
          const current = await loadSettings()
          await saveSettings({ ...current, stockWatchlist: next })
        },
        '관심종목 저장에 실패했습니다.',
        'settings'
      )
      return next
    })
  }, [persist, setStockWatchlist])

  const handleAddMemo = useCallback((title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => {
    setMemos((prev) => {
      const now = Date.now()
      const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now, date, dateEnd, amount, transactionType, category }]
      persist(() => saveMemos(next), '메모 저장에 실패했습니다.', 'memos')
      return next
    })
  }, [persist, setMemos])

  const handleUpdateMemo = useCallback((id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now(), date, dateEnd, amount, transactionType, category } : m)
      persist(() => saveMemos(next), '메모 수정 저장에 실패했습니다.', 'memos')
      return next
    })
  }, [persist, setMemos])

  const handleDeleteMemo = useCallback((id: string) => {
    dispatchUI({
      type: 'OPEN_CONFIRM',
      message: '이 메모를 삭제할까요?',
      onConfirm: () => {
        setMemos((prev) => {
          const next = prev.filter((m) => m.id !== id)
          persist(() => saveMemos(next), '메모 삭제 저장에 실패했습니다.', 'memos')
          return next
        })
      },
    })
  }, [persist, setMemos, dispatchUI])

  const handleTogglePin = useCallback((id: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m)
      persist(() => saveMemos(next), '메모 고정 상태 저장에 실패했습니다.', 'memos')
      return next
    })
  }, [persist, setMemos])

  return {
    handleSaveTransaction,
    handleDeleteTransaction,
    handleBulkEditTransactions,
    handleBulkDeleteTransactions,
    handleTransactionArchive,
    handleBulkImport,
    handleSaveStockTrade,
    handleDeleteStockTrade,
    handleBudgetsChange,
    handleRecurringSave,
    handleSubscriptionsChange,
    handleGoalsChange,
    handleApplyRecurring,
    handleSavePaymentMethods,
    handleSaveTemplates,
    handleSaveAutoCategoryRules,
    handleRenameTag,
    handleDeleteTag,
    handleSaveHiddenWidgets,
    handleSaveCategories,
    handleAddWatchTicker,
    handleRemoveWatchTicker,
    handleAddMemo,
    handleUpdateMemo,
    handleDeleteMemo,
    handleTogglePin,
  }
}
