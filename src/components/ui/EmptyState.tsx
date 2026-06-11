interface Props {
  emoji?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export default function EmptyState({ emoji = '📋', title, description, action, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <p className="text-5xl mb-4 select-none">{emoji}</p>
      <p className="font-bold text-white text-[15px]">{title}</p>
      {description && (
        <p className="text-xs text-[#4E5968] mt-1.5 max-w-[240px] leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-xs font-bold px-4 py-2 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
