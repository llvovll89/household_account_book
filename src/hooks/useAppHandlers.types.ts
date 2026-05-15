import type { StockTrade, Transaction } from '../types'
import type { StockSubTab } from '../types/navigation'

export type UIAction =
  | { type: 'OPEN_TX_MODAL'; editing?: Transaction }
  | { type: 'CLOSE_TX_MODAL' }
  | { type: 'OPEN_STOCK_MODAL'; editing?: StockTrade }
  | { type: 'CLOSE_STOCK_MODAL' }
  | { type: 'SET_IMPORT'; value: boolean }
  | { type: 'SET_HELP'; value: boolean }
  | { type: 'SET_CATEGORY'; value: boolean }
  | { type: 'SET_STOCK_SUBTAB'; value: StockSubTab }
  | { type: 'TRIGGER_MEMO' }
  | { type: 'TRIGGER_SUB' }
  | { type: 'TRIGGER_GOAL' }
