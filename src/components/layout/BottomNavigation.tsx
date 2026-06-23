import { BarChart2, List, PieChart, Star } from 'lucide-react'
import type { ComponentType } from 'react'
import type { AppMode, StockSubTab, Tab } from '../../types/navigation'

interface LedgerTabItem {
  id: Tab
  label: string
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface Props {
  activeMode: AppMode
  ledgerTabs: LedgerTabItem[]
  activeTab: Tab
  stockSubTab: StockSubTab
  onLedgerTabChange: (tab: Tab) => void
  onStockSubTabChange: (tab: StockSubTab) => void
  onLedgerTabHover?: (tab: Tab) => void
  onStockSubTabHover?: (tab: StockSubTab) => void
}

const STOCKS_SUB_TABS: Array<{
  id: StockSubTab
  label: string
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}> = [
  { id: 'portfolio', label: '포트', Icon: PieChart },
  { id: 'watchlist', label: '관심', Icon: Star },
  { id: 'trades', label: '내역', Icon: List },
  { id: 'performance', label: '성과', Icon: BarChart2 },
]

export default function BottomNavigation({
  activeMode,
  ledgerTabs,
  activeTab,
  stockSubTab,
  onLedgerTabChange,
  onStockSubTabChange,
  onLedgerTabHover,
  onStockSubTabHover,
}: Props) {
  const ledgerActiveIdx = ledgerTabs.findIndex((t) => t.id === activeTab)
  const stockActiveIdx = STOCKS_SUB_TABS.findIndex((t) => t.id === stockSubTab)
  const tabListLabel = activeMode === 'ledger' ? '가계부 하단 탭' : '주식 하단 탭'

  return (
    <nav aria-label="하단 탭 메뉴" className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto bg-[#111111]/90 backdrop-blur-xl border-t border-[rgba(255,255,255,0.06)]">
        <div role="tablist" aria-label={tabListLabel} className="relative flex pb-safe">
          {/* 슬라이딩 인디케이터 */}
          {activeMode === 'ledger' && ledgerActiveIdx >= 0 && (
            <div
              className="absolute top-0 h-0.5 w-8 bg-[#3D8EF8] rounded-full transition-all duration-200 ease-out"
              style={{ left: `calc(${(ledgerActiveIdx / ledgerTabs.length) * 100}% + ${100 / ledgerTabs.length / 2}% - 16px)` }}
            />
          )}
          {activeMode === 'stocks' && stockActiveIdx >= 0 && (
            <div
              className="absolute top-0 h-0.5 w-8 bg-[#F5BE3A] rounded-full transition-transform duration-200 ease-out"
              style={{ left: `calc(${(stockActiveIdx / STOCKS_SUB_TABS.length) * 100}% + ${100 / STOCKS_SUB_TABS.length / 2}% - 16px)` }}
            />
          )}
          {activeMode === 'ledger' && ledgerTabs.map(({ id, label, Icon }) => {
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
          {activeMode === 'stocks' && STOCKS_SUB_TABS.map(({ id, label, Icon }) => {
            const isActive = stockSubTab === id
            return (
              <button
                type="button"
                key={id}
                onClick={() => onStockSubTabChange(id)}
                onMouseEnter={() => onStockSubTabHover?.(id)}
                onFocus={() => onStockSubTabHover?.(id)}
                onTouchStart={() => onStockSubTabHover?.(id)}
                role="tab"
                aria-selected={isActive}
                aria-label={`${label} 탭`}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-3.5 min-h-15 transition-colors"
              >
                <div className={`flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 ${isActive ? 'bg-[#F5BE3A]/15' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} className={`transition-colors duration-150 ${isActive ? 'text-[#F5BE3A]' : 'text-[#8B95A1]/75'}`} />
                </div>
                <span className={`text-[11px] font-bold transition-colors duration-150 ${isActive ? 'text-[#F5BE3A]' : 'text-[#8B95A1]/75'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
