import { useCallback } from 'react'
import type { Dispatch } from 'react'
import type { AutoCategoryRule, DashboardWidgetId, Transaction, Memo, Budget, RecurringTransaction, Subscription, SavingsGoal, TransactionType, UserPaymentMethod, TransactionTemplate } from '../types'
import type { RemoteVersionKey } from '../lib/storage'
import { saveBudgets, saveMemos, saveRecurring, saveSettings, saveSubscriptions, saveGoals, saveTransactions, loadSettings } from '../lib/storage'
import { generateId, toLocalDateStr } from '../lib/format'
import { showToast } from '../lib/toast'
import { auth } from '../firebase/firebase'
import { deleteReceiptImage } from '../lib/receiptStorage'
import type { UIAction } from './useAppHandlers.types'

export type { UIAction }

interface HandlersInput {
  transactions: Transaction[]
  editingTransaction: Transaction | null
  yearMonth: string
  customExpenseCategories: string[]
  customIncomeCategories: string[]
  transactionTemplates: TransactionTemplate[]
  autoCategoryRules: AutoCategoryRule[]
  persist: (task: () => Promise<void>, failMsg: string, scope: RemoteVersionKey) => void
  setTransactions: Dispatch<React.SetStateAction<Transaction[]>>
  setBudgets: Dispatch<React.SetStateAction<Budget[]>>
  setRecurring: Dispatch<React.SetStateAction<RecurringTransaction[]>>
  setSubscriptions: Dispatch<React.SetStateAction<Subscription[]>>
  setGoals: Dispatch<React.SetStateAction<SavingsGoal[]>>
  setMemos: Dispatch<React.SetStateAction<Memo[]>>
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
  yearMonth,
  customExpenseCategories,
  customIncomeCategories,
  transactionTemplates,
  autoCategoryRules,
  persist,
  setTransactions,
  setBudgets,
  setRecurring,
  setSubscriptions,
  setGoals,
  setMemos,
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
    const todayStr = toLocalDateStr()
    const newTx: Transaction[] = pending.map((r) => ({
      id: generateId(),
      type: r.type,
      amount: r.amount,
      paymentMethod: 'cash',
      category: r.category,
      description: r.description,
      date: (r.frequency === 'weekly' || r.frequency === 'biweekly')
        ? todayStr
        : `${ym}-${String(r.dayOfMonth).padStart(2, '0')}`,
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
      const next = prev.map((r) => {
        if (!ids.has(r.id)) return r
        return (r.frequency === 'weekly' || r.frequency === 'biweekly')
          ? { ...r, lastAppliedDate: todayStr }
          : { ...r, lastAppliedMonth: ym }
      })
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
    dispatchUI({
      type: 'OPEN_CONFIRM',
      message: `"${name}" 태그를 삭제할까요? 이 태그가 달린 모든 내역에서 제거돼요.`,
      confirmLabel: '삭제',
      confirmVariant: 'danger',
      onConfirm: () => {
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
      },
    })
  }, [persist, setTransactions, dispatchUI])

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
    const removedExpense = customExpenseCategories.filter((c) => !expense.includes(c))
    const removedIncome = customIncomeCategories.filter((c) => !income.includes(c))
    const removed = new Set([...removedExpense, ...removedIncome])
    const fallbackFor = (type: TransactionType) => (type === 'income' ? '기타수입' : '기타지출')

    setCustomExpenseCategories(expense)
    setCustomIncomeCategories(income)

    // 삭제된 카테고리를 쓰던 템플릿/자동분류규칙은 폴백 카테고리로 재매핑
    const nextTemplates = removed.size === 0
      ? transactionTemplates
      : transactionTemplates.map((tpl) => (removed.has(tpl.category) ? { ...tpl, category: fallbackFor(tpl.type) } : tpl))
    const nextRules = removed.size === 0
      ? autoCategoryRules
      : autoCategoryRules.map((rule) => (removed.has(rule.category) ? { ...rule, category: fallbackFor(rule.type) } : rule))
    if (removed.size > 0) {
      setTransactionTemplates(nextTemplates)
      setAutoCategoryRules(nextRules)
    }

    persist(
      async () => {
        const current = await loadSettings()
        await saveSettings({
          ...current,
          customExpenseCategories: expense,
          customIncomeCategories: income,
          transactionTemplates: nextTemplates,
          autoCategoryRules: nextRules,
        })
      },
      '카테고리 저장에 실패했습니다.',
      'settings'
    )

    if (removed.size === 0) return

    // 삭제된 카테고리를 쓰던 거래/반복거래도 폴백 카테고리로 재매핑 (데이터 보존)
    setTransactions((prev) => {
      const next = prev.map((t) => (removed.has(t.category) ? { ...t, category: fallbackFor(t.type) } : t))
      persist(() => saveTransactions(next), '거래 카테고리 정리에 실패했습니다.', 'transactions')
      return next
    })

    setRecurring((prev) => {
      const next = prev.map((r) => (removed.has(r.category) ? { ...r, category: fallbackFor(r.type) } : r))
      persist(() => saveRecurring(next), '반복거래 카테고리 정리에 실패했습니다.', 'recurring')
      return next
    })

    // 예산은 재분류 개념이 없으므로, 삭제된 지출 카테고리의 항목(월별 오버라이드 포함)은 제거
    if (removedExpense.length > 0) {
      setBudgets((prev) => {
        const next = prev.filter((b) => !removedExpense.includes(b.category))
        persist(() => saveBudgets(next), '예산 정리에 실패했습니다.', 'budgets')
        return next
      })
    }
  }, [
    persist,
    customExpenseCategories,
    customIncomeCategories,
    transactionTemplates,
    autoCategoryRules,
    setCustomExpenseCategories,
    setCustomIncomeCategories,
    setTransactionTemplates,
    setAutoCategoryRules,
    setTransactions,
    setRecurring,
    setBudgets,
  ])

  const handleAddMemo = useCallback((title: string, content: string, category?: string, date?: string, dateEnd?: string) => {
    setMemos((prev) => {
      const now = Date.now()
      const next = [...prev, { id: generateId(), title, content, pinned: false, createdAt: now, updatedAt: now, date, dateEnd, category }]
      persist(() => saveMemos(next), '메모 저장에 실패했습니다.', 'memos')
      return next
    })
  }, [persist, setMemos])

  const handleUpdateMemo = useCallback((id: string, title: string, content: string, category?: string, date?: string, dateEnd?: string) => {
    setMemos((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, title, content, updatedAt: Date.now(), date, dateEnd, category } : m)
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
    handleAddMemo,
    handleUpdateMemo,
    handleDeleteMemo,
    handleTogglePin,
  }
}
