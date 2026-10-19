import { BriefcaseBusiness, Laptop, Gift, TrendingUp, Wallet, Utensils, Bus, House, Smartphone, HeartPulse, ShoppingBag, Gamepad2, BookOpen, Landmark, HandCoins, ShieldCheck, Archive } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
// Map by name so adding or reordering categories never shifts existing icons.
const categoryIcons: Record<string, LucideIcon> = {
  급여: BriefcaseBusiness, 부업: Laptop, 용돈: Gift, 투자수익: TrendingUp, 기타수입: Wallet,
  식비: Utensils, 교통비: Bus, 주거비: House, 통신비: Smartphone, 의료비: HeartPulse,
  쇼핑: ShoppingBag, '문화/여가': Gamepad2, 교육: BookOpen, 저축: Landmark,
  대출: HandCoins, 보험: ShieldCheck, 기타지출: Archive,
}

export default function CategoryIcon({ category, size = 19 }: { category: string; size?: number }) {
  const Icon = categoryIcons[category] ?? Archive
  return <Icon size={size} aria-hidden="true" className="category-icon" />
}
