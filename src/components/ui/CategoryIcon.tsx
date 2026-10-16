import { BriefcaseBusiness, Laptop, Gift, TrendingUp, Wallet, Utensils, Bus, House, Smartphone, HeartPulse, ShoppingBag, Gamepad2, BookOpen, Landmark, Archive } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../../types'

const categoryIcons: Record<string, LucideIcon> = Object.fromEntries([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((name, index) => [name, [BriefcaseBusiness, Laptop, Gift, TrendingUp, Wallet, Utensils, Bus, House, Smartphone, HeartPulse, ShoppingBag, Gamepad2, BookOpen, Landmark, Archive][index]]))

export default function CategoryIcon({ category, size = 19 }: { category: string; size?: number }) {
  const Icon = categoryIcons[category] ?? Archive
  return <Icon size={size} aria-hidden="true" className="category-icon" />
}
