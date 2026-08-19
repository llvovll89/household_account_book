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

  return (
    <div className={`flex flex-col items-center justify-center text-center ${isCompact ? 'py-6 gap-2' : 'py-12 px-6'} ${className}`}>
      {Icon ? (
        <Icon size={isCompact ? 28 : 40} className="text-[#2C2C2E]" />
      ) : (
        <p className={`select-none ${isCompact ? 'text-3xl' : 'text-5xl mb-4'}`}>{emoji}</p>
      )}
      <p className={`font-bold text-white ${isCompact ? 'text-sm font-semibold text-[#4E5968]' : 'text-[15px]'}`}>{title}</p>
      {description && (
        <p className={`text-[#4E5968] ${isCompact ? 'text-xs' : 'text-xs mt-1.5 max-w-[240px] leading-relaxed'}`}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`text-xs font-bold px-4 py-2 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] transition-colors ${isCompact ? 'mt-3' : 'mt-4'}`}
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  )
}
