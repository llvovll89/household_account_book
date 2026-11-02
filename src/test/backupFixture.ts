import type { AppDataSnapshot } from '../lib/storage'

export function backupFixture(): AppDataSnapshot {
  return {
    transactions: [{ id: 'tx', type: 'expense', amount: 12000, category: '대출', description: '상환', date: '2026-11-02', dateEnd: '2026-11-03', createdAt: 1, tags: ['집'], paymentMethod: 'transfer', paymentMethodId: 'bank', creditBillingDay: 25, receiptImageUrl: 'https://example.com/receipt', loanPrincipal: 10000, loanInterest: 2000 }],
    memos: [{ id: 'memo', title: '장보기', content: '우유', pinned: true, createdAt: 1, updatedAt: 2, date: '2026-11-02', dateEnd: '2026-11-03', category: '할일' }],
    budgets: [{ category: '식비', limit: 200000, carryover: true }, { category: '식비', limit: 300000, carryover: false, yearMonth: '2026-11' }],
    recurring: [{ id: 'rec', type: 'expense', amount: 10000, category: '보험', description: '', createdAt: 1, frequency: 'biweekly', weekday: 1, dayOfMonth: 1, lastAppliedMonth: '', lastAppliedDate: '2026-10-26', paymentMethod: 'transfer', paymentMethodId: 'bank', creditBillingDay: 25 }],
    subscriptions: [{ id: 'sub', name: '구독', amount: 9.99, currency: 'USD', billingDay: 31, category: '문화/여가', memo: '매월', color: '#123456', createdAt: 1 }],
    goals: [{ id: 'goal', name: '여행', targetAmount: 1000000, currentAmount: 150000, emoji: '✈️', color: '#123456', deadline: '2027-01-01', memo: '겨울', createdAt: 1, linkedCategory: '저축', linkedTags: ['여행'] }],
    settings: { payday: 'last', cardBillingDay: 25, userPaymentMethods: [{ id: 'bank', type: 'transfer', label: '계좌' }, { id: 'credit', type: 'credit', label: '카드', billingDay: 15 }], customExpenseCategories: ['운동'], customIncomeCategories: ['배당'], transactionTemplates: [{ id: 'tpl', label: '점심', type: 'expense', amount: 9000, category: '식비', description: '식사', createdAt: 1, paymentMethod: 'cash', paymentMethodId: 'cash' }], swipeSensitivity: 'high', autoCategoryRules: [{ id: 'rule', keyword: '카페', category: '식비', type: 'expense', enabled: false }], hiddenWidgets: ['health-score'] },
  }
}
