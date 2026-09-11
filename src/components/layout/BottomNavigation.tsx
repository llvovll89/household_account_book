import type { ComponentType } from 'react'
import type { Tab } from '../../types/navigation'

interface LedgerTabItem {
  id: Tab
  label: string
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface Props {
  ledgerTabs: LedgerTabItem[]
  activeTab: Tab
  onLedgerTabChange: (tab: Tab) => void
  onLedgerTabHover?: (tab: Tab) => void
}

export default function BottomNavigation({
  ledgerTabs,
  activeTab,
  onLedgerTabChange,
  onLedgerTabHover,
}: Props) {
  return (
    <nav aria-label="하단 탭 메뉴" className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto bg-[#1C1C1E]/95 backdrop-blur-xl border-t border-[rgba(255,255,255,0.06)]">
        <div aria-label="가계부 하단 탭" className="relative flex pb-safe">
          {ledgerTabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                type="button"
                key={id}
                onClick={() => onLedgerTabChange(id)}
                onMouseEnter={() => onLedgerTabHover?.(id)}
                onFocus={() => onLedgerTabHover?.(id)}
                onTouchStart={() => onLedgerTabHover?.(id)}
                aria-label={`${label} 탭`}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex flex-col items-center gap-1 pt-3 pb-3 min-h-[68px] transition-colors"
              >
                <div className={`flex items-center justify-center w-7 h-7 transition-colors duration-200`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} className={`transition-colors duration-150 ${isActive ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`} />
                </div>
                <span className={`text-[11px] font-bold transition-colors duration-150 ${isActive ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
