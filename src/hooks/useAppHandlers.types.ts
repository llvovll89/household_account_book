import type { Transaction } from '../types'

export type UIAction =
  | { type: 'OPEN_TX_MODAL'; editing?: Transaction }
  | { type: 'CLOSE_TX_MODAL' }
  | { type: 'SET_IMPORT'; value: boolean }
  | { type: 'SET_HELP'; value: boolean }
  | { type: 'SET_CATEGORY'; value: boolean }
  | { type: 'SET_PAYMENT_METHODS'; value: boolean }
  | { type: 'TRIGGER_MEMO' }
  | { type: 'TRIGGER_SUB' }
  | { type: 'TRIGGER_GOAL' }
  | { type: 'OPEN_CONFIRM'; message: string; onConfirm: () => void; confirmLabel?: string; confirmVariant?: 'danger' | 'primary' }
  | { type: 'CLOSE_CONFIRM' }
