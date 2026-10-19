import { Banknote, CreditCard, Landmark, Wallet } from 'lucide-react'
import type { PaymentMethod } from '../../types'

export default function PaymentMethodIcon({ method, size = 15 }: { method: PaymentMethod; size?: number }) {
  const Icon = method === 'transfer' ? Landmark : method === 'cash' ? Banknote : method === 'check' ? Wallet : CreditCard
  return <Icon size={size} aria-hidden="true" className="inline-block align-middle shrink-0" />
}
