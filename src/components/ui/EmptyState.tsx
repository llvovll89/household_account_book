import { Archive, Bookmark, CalendarDays, ChartNoAxesCombined, CreditCard, FileText, FolderOpen, Inbox, Search, Tag, Target, Wallet } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

interface Props {
  emoji?: string
  icon?: ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  size?: 'default' | 'compact'
  className?: string
  children?: ReactNode
}

export default function EmptyState({ emoji = '📋', icon: Icon, title, description, action, size = 'default', className = '', children }: Props) {
  const isCompact = size === 'compact'
  const icons = { '📋': FileText, '📊': ChartNoAxesCombined, '💳': CreditCard, '💰': Wallet, '🎯': Target, '📝': FileText, '🔖': Bookmark, '🔍': Search, '📅': CalendarDays, '📦': Archive, '📂': FolderOpen, '🏷️': Tag }
  const EmptyIcon = Icon ?? icons[emoji as keyof typeof icons] ?? Inbox

  return (
    <div className={`ledger-empty-state flex flex-col items-center justify-center text-center ${isCompact ? 'py-6 gap-2' : 'py-12 px-6'} ${className}`}>
      <div className="empty-state-mark"><EmptyIcon size={isCompact ? 24 : 28} aria-hidden="true" /></div>
      <p className={`font-bold text-white ${isCompact ? 'text-sm font-semibold text-[#9CA6B3]' : 'text-[15px]'}`}>{title}</p>
      {description && (
        <p className={`text-[#9CA6B3] ${isCompact ? 'text-xs' : 'text-xs mt-1.5 max-w-[240px] leading-relaxed'}`}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`min-h-11 text-sm font-semibold px-4 py-2 rounded-xl bg-[#244268] text-[#DCEBFF] hover:bg-[#315780] transition-colors ${isCompact ? 'mt-3' : 'mt-4'}`}
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  )
}
