import type { Budget, Memo, RecurringTransaction, Subscription, Transaction, TransactionType } from '../../types'
import type { Tab } from '../../types/navigation'
import Dashboard from '../Dashboard'
import TransactionList from '../TransactionList'
import Analytics from '../Analytics'
import MemoSection from '../MemoSection'
import SubscriptionView from '../SubscriptionView'

interface Props {
  activeTab: Tab
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  subscriptions: Subscription[]
  settingsVersion: number
  yearMonth: string
  customExpenseCategories: string[]
  memos: Memo[]
  memoAddTrigger: number
  subscriptionAddTrigger: number
  onBudgetsChange: (budgets: Budget[]) => void
  onRecurringSave: (items: RecurringTransaction[]) => void
  onApplyRecurring: (pending: RecurringTransaction[]) => void
  onSubscriptionsChange: (items: Subscription[]) => void
  onOpenCategoryModal: () => void
  onTransactionEdit: (t: Transaction) => void
  onTransactionDelete: (id: string) => void
  onMemoAdd: (title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => void
  onMemoUpdate: (id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => void
  onMemoDelete: (id: string) => void
  onMemoTogglePin: (id: string) => void
}

export default function LedgerWorkspace({
  activeTab,
  transactions,
  budgets,
  recurring,
  subscriptions,
  settingsVersion,
  yearMonth,
  customExpenseCategories,
  memos,
  memoAddTrigger,
  subscriptionAddTrigger,
  onBudgetsChange,
  onRecurringSave,
  onApplyRecurring,
  onSubscriptionsChange,
  onOpenCategoryModal,
  onTransactionEdit,
  onTransactionDelete,
  onMemoAdd,
  onMemoUpdate,
  onMemoDelete,
  onMemoTogglePin,
}: Props) {
  return (
    <>
      {activeTab === 'home' && (
        <Dashboard
          transactions={transactions}
          budgets={budgets}
          recurring={recurring}
          settingsVersion={settingsVersion}
          yearMonth={yearMonth}
          customExpenseCategories={customExpenseCategories}
          onBudgetsChange={onBudgetsChange}
          onRecurringSave={onRecurringSave}
          onApplyRecurring={onApplyRecurring}
          onOpenCategoryModal={onOpenCategoryModal}
        />
      )}
      {activeTab === 'transactions' && (
        <TransactionList
          transactions={transactions}
          yearMonth={yearMonth}
          onEdit={onTransactionEdit}
          onDelete={onTransactionDelete}
        />
      )}
      {activeTab === 'analytics' && <Analytics transactions={transactions} yearMonth={yearMonth} budgets={budgets} />}
      {activeTab === 'memos' && (
        <MemoSection
          memos={memos}
          onAdd={onMemoAdd}
          onUpdate={onMemoUpdate}
          onDelete={onMemoDelete}
          onTogglePin={onMemoTogglePin}
          externalAddTrigger={memoAddTrigger}
        />
      )}
      {activeTab === 'subscriptions' && (
        <SubscriptionView
          subscriptions={subscriptions}
          addTrigger={subscriptionAddTrigger}
          onChange={onSubscriptionsChange}
        />
      )}
    </>
  )
}
