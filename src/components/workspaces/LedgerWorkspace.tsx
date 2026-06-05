import { Suspense, lazy } from 'react'
import type { Budget, DashboardWidgetId, Memo, RecurringTransaction, SavingsGoal, StockTrade, Subscription, Transaction, TransactionType, UserPaymentMethod } from '../../types'
import type { Tab } from '../../types/navigation'

const Dashboard = lazy(() => import('../Dashboard'))
const TransactionList = lazy(() => import('../TransactionList'))
const Analytics = lazy(() => import('../Analytics'))
const MemoSection = lazy(() => import('../MemoSection'))
const SubscriptionView = lazy(() => import('../SubscriptionView'))
const GoalsView = lazy(() => import('../GoalsView'))

function TabFallback() {
  return (
    <div className="bg-[#1C1C1E] rounded-2xl p-6 text-center">
      <p className="text-sm font-semibold text-[#8B95A1]">탭 화면을 불러오는 중...</p>
    </div>
  )
}

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
  userPaymentMethods: UserPaymentMethod[]
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
  onOpenPaymentMethodsModal: () => void
  onTransactionEdit: (t: Transaction) => void
  onTransactionDelete: (id: string) => void
  onBulkDeleteTransactions?: (ids: string[]) => void
  onBulkEditTransactions?: (ids: string[], category: string) => void
  onTransactionArchive: (cutoff: string) => void
  onMemoAdd: (title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => void
  onMemoUpdate: (id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string, dateEnd?: string) => void
  onMemoDelete: (id: string) => void
  onMemoTogglePin: (id: string) => void
  hiddenWidgets?: DashboardWidgetId[]
  onOpenTagManager?: () => void
  onOpenWidgetSettings?: () => void
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
  userPaymentMethods,
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
  onOpenPaymentMethodsModal,
  onTransactionEdit,
  onTransactionDelete,
  onBulkDeleteTransactions,
  onBulkEditTransactions,
  onTransactionArchive,
  onMemoAdd,
  onMemoUpdate,
  onMemoDelete,
  onMemoTogglePin,
  hiddenWidgets = [],
  onOpenTagManager,
  onOpenWidgetSettings,
}: Props) {
  return (
    <>
      {activeTab === 'home' && (
        <div key="home" className="tab-content">
          <Suspense fallback={<TabFallback />}>
            <Dashboard
              transactions={transactions}
              budgets={budgets}
              recurring={recurring}
              stockTrades={stockTrades}
              goals={goals}
              settingsVersion={settingsVersion}
              yearMonth={yearMonth}
              customExpenseCategories={customExpenseCategories}
              userPaymentMethods={userPaymentMethods}
              subscriptions={subscriptions}
              hiddenWidgets={hiddenWidgets}
              onBudgetsChange={onBudgetsChange}
              onRecurringSave={onRecurringSave}
              onApplyRecurring={onApplyRecurring}
              onOpenCategoryModal={onOpenCategoryModal}
              onOpenPaymentMethodsModal={onOpenPaymentMethodsModal}
              onOpenWidgetSettings={onOpenWidgetSettings}
            />
          </Suspense>
        </div>
      )}
      {activeTab === 'transactions' && (
        <div key="transactions" className="tab-content">
          <Suspense fallback={<TabFallback />}>
            <TransactionList
              transactions={transactions}
              yearMonth={yearMonth}
              userPaymentMethods={userPaymentMethods}
              onEdit={onTransactionEdit}
              onDelete={onTransactionDelete}
              onBulkDelete={onBulkDeleteTransactions}
              onBulkEdit={onBulkEditTransactions}
              onArchiveDone={onTransactionArchive}
              onOpenTagManager={onOpenTagManager}
            />
          </Suspense>
        </div>
      )}
      {activeTab === 'analytics' && (
        <div key="analytics" className="tab-content">
          <Suspense fallback={<TabFallback />}>
            <Analytics transactions={transactions} yearMonth={yearMonth} budgets={budgets} settingsVersion={settingsVersion} userPaymentMethods={userPaymentMethods} />
          </Suspense>
        </div>
      )}
      {activeTab === 'memos' && (
        <div key="memos" className="tab-content">
          <Suspense fallback={<TabFallback />}>
            <MemoSection
              memos={memos}
              onAdd={onMemoAdd}
              onUpdate={onMemoUpdate}
              onDelete={onMemoDelete}
              onTogglePin={onMemoTogglePin}
              externalAddTrigger={memoAddTrigger}
            />
          </Suspense>
        </div>
      )}
      {activeTab === 'subscriptions' && (
        <div key="subscriptions" className="tab-content">
          <Suspense fallback={<TabFallback />}>
            <SubscriptionView
              subscriptions={subscriptions}
              addTrigger={subscriptionAddTrigger}
              onChange={onSubscriptionsChange}
            />
          </Suspense>
        </div>
      )}
      {activeTab === 'goals' && (
        <div key="goals" className="tab-content">
          <Suspense fallback={<TabFallback />}>
            <GoalsView
              goals={goals}
              transactions={transactions}
              addTrigger={goalAddTrigger}
              onChange={onGoalsChange}
            />
          </Suspense>
        </div>
      )}
    </>
  )
}
