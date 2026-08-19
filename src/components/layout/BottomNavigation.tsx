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
  const ledgerActiveIdx = ledgerTabs.findIndex((t) => t.id === activeTab)

  return (
    <nav aria-label="하단 탭 메뉴" className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto bg-[#111111]/90 backdrop-blur-xl border-t border-[rgba(255,255,255,0.06)]">
        <div role="tablist" aria-label="가계부 하단 탭" className="relative flex pb-safe">
          {/* 슬라이딩 인디케이터 */}
          {ledgerActiveIdx >= 0 && (
            <div
              className="absolute top-0 h-0.5 w-8 bg-[#3D8EF8] rounded-full transition-all duration-200 ease-out"
              style={{ left: `calc(${(ledgerActiveIdx / ledgerTabs.length) * 100}% + ${100 / ledgerTabs.length / 2}% - 16px)` }}
            />
          )}
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
                role="tab"
                aria-selected={isActive}
                aria-label={`${label} 탭`}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-3.5 min-h-15 transition-colors"
              >
                <div className={`flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 ${isActive ? 'bg-[#3D8EF8]/15' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} className={`transition-colors duration-150 ${isActive ? 'text-[#3D8EF8]' : 'text-[#8B95A1]/75'}`} />
                </div>
                <span className={`text-[11px] font-bold transition-colors duration-150 ${isActive ? 'text-[#3D8EF8]' : 'text-[#8B95A1]/75'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
