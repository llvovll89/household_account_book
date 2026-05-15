import type { Budget, Memo, RecurringTransaction, SavingsGoal, StockTrade, Subscription, Transaction, TransactionType } from '../../types'
import type { Tab } from '../../types/navigation'
import Dashboard from '../Dashboard'
import TransactionList from '../TransactionList'
import Analytics from '../Analytics'
import MemoSection from '../MemoSection'
import SubscriptionView from '../SubscriptionView'
import GoalsView from '../GoalsView'

interface Props {
  activeTab: Tab
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  stockTrades: StockTrade[]
  subscriptions: Subscription[]
  goals: SavingsGoal[]
  settingsVersion: number
  yearMonth: string
  customExpenseCategories: string[]
  memos: Memo[]
  memoAddTrigger: number
  subscriptionAddTrigger: number
  goalAddTrigger: number
  onBudgetsChange: (budgets: Budget[]) => void
  onRecurringSave: (items: RecurringTransaction[]) => void
  onApplyRecurring: (pending: RecurringTransaction[]) => void
  onSubscriptionsChange: (items: Subscription[]) => void
  onGoalsChange: (items: SavingsGoal[]) => void
  onOpenCategoryModal: () => void
  onTransactionEdit: (t: Transaction) => void
  onTransactionDelete: (id: string) => void
  onTransactionArchive: (cutoff: string) => void
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
  stockTrades,
  subscriptions,
  goals,
  settingsVersion,
  yearMonth,
  customExpenseCategories,
  memos,
  memoAddTrigger,
  subscriptionAddTrigger,
  goalAddTrigger,
  onBudgetsChange,
  onRecurringSave,
  onApplyRecurring,
  onSubscriptionsChange,
  onGoalsChange,
  onOpenCategoryModal,
  onTransactionEdit,
  onTransactionDelete,
  onTransactionArchive,
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
          stockTrades={stockTrades}
          goals={goals}
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
          onArchiveDone={onTransactionArchive}
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
      {activeTab === 'goals' && (
        <GoalsView
          goals={goals}
          addTrigger={goalAddTrigger}
          onChange={onGoalsChange}
        />
      )}
    </>
  )
}
