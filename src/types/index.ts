export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  description: string
  tags?: string[]
  date: string // YYYY-MM-DD
  createdAt: number
}

export interface Memo {
  id: string
  title: string
  content: string
  pinned: boolean
  createdAt: number
  updatedAt: number
  date?: string // YYYY-MM-DD (사용자 지정 날짜)
  amount?: number
  transactionType?: TransactionType
  category?: string
}

export interface Budget {
  category: string
  limit: number // 월 예산 (원)
}

export interface RecurringTransaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  description: string
  dayOfMonth: number       // 매월 몇 일 (1-31)
  lastAppliedMonth: string // 마지막으로 등록된 월 YYYY-MM ('' = 미등록)
  createdAt: number
}

export const INCOME_CATEGORIES = ['급여', '부업', '용돈', '투자수익', '기타수입']

export const EXPENSE_CATEGORIES = [
  '식비', '교통비', '주거비', '통신비', '의료비',
  '쇼핑', '문화/여가', '교육', '저축', '기타지출',
]

// 다크 테마 카테고리 색상
export const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  급여:        { bg: 'rgba(61,142,248,0.15)',  text: '#4D9EFF' },
  부업:        { bg: 'rgba(155,126,255,0.15)', text: '#9B7EFF' },
  용돈:        { bg: 'rgba(240,110,196,0.15)', text: '#F06EC4' },
  투자수익:    { bg: 'rgba(42,207,106,0.15)',  text: '#2ACF6A' },
  기타수입:    { bg: 'rgba(31,217,180,0.15)',  text: '#1FD9B4' },
  식비:        { bg: 'rgba(255,160,46,0.15)',  text: '#FFA02E' },
  교통비:      { bg: 'rgba(61,142,248,0.15)',  text: '#4D9EFF' },
  주거비:      { bg: 'rgba(245,190,58,0.15)',  text: '#F5BE3A' },
  통신비:      { bg: 'rgba(155,126,255,0.15)', text: '#9B7EFF' },
  의료비:      { bg: 'rgba(242,82,96,0.15)',   text: '#F25260' },
  쇼핑:        { bg: 'rgba(240,110,196,0.15)', text: '#F06EC4' },
  '문화/여가': { bg: 'rgba(61,154,255,0.15)',  text: '#3D9AFF' },
  교육:        { bg: 'rgba(0,212,255,0.15)',   text: '#00D4FF' },
  저축:        { bg: 'rgba(42,207,106,0.15)',  text: '#2ACF6A' },
  기타지출:    { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' },
}

export type StockTradeType = 'buy' | 'sell'

export interface StockTrade {
  id: string
  ticker: string        // 종목명 (예: "삼성전자", "AAPL")
  tradeType: StockTradeType
  quantity: number      // 수량 (소수 허용 - ETF/해외주식)
  price: number         // 주당 단가
  fee: number           // 수수료 (0 허용)
  currency: string      // 'KRW' | 'USD' 등 (기본 'KRW')
  date: string          // YYYY-MM-DD
  note: string          // 메모 (선택)
  createdAt: number
}

export interface StockHolding {
  ticker: string
  quantity: number
  avgBuyPrice: number
  totalCost: number
  realizedPnL: number
  totalFee: number
}

export interface StockQuote {
  symbol: string
  ticker: string
  currentPrice: number
  prevClose: number
  change: number
  changePct: number
  currency: string
  marketState: string
  shortName: string
  lastUpdated: number
}

export interface MonthlyDataPoint {
  ym: string
  label: string
  income: number
  expense: number
  balance: number
}

export const CATEGORY_EMOJI: Record<string, string> = {
  급여: '💼', 부업: '💻', 용돈: '🎁', 투자수익: '📈', 기타수입: '💰',
  식비: '🍽️', 교통비: '🚌', 주거비: '🏠', 통신비: '📱', 의료비: '🏥',
  쇼핑: '🛍️', '문화/여가': '🎮', 교육: '📚', 저축: '🏦', 기타지출: '📦',
}
