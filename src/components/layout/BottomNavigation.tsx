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
}: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto bg-[#0D0F14] border-t border-white/6">
        <div className="flex pb-safe">
          {activeMode === 'ledger' && ledgerTabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => onLedgerTabChange(id)} className="flex-1 flex flex-col items-center gap-1 pt-3 pb-4 transition-colors relative">
              {activeTab === id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#3D8EF8] rounded-full" />}
              <Icon size={21} strokeWidth={activeTab === id ? 2.5 : 1.8} className={activeTab === id ? 'text-[#3D8EF8]' : 'text-white/40'} />
              <span className={`text-[10px] font-bold ${activeTab === id ? 'text-[#3D8EF8]' : 'text-white/40'}`}>{label}</span>
            </button>
          ))}
          {activeMode === 'stocks' && STOCKS_SUB_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => onStockSubTabChange(id)} className="flex-1 flex flex-col items-center gap-1 pt-3 pb-4 transition-colors relative">
              {stockSubTab === id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#F5BE3A] rounded-full" />}
              <Icon size={20} strokeWidth={stockSubTab === id ? 2.5 : 1.8} className={stockSubTab === id ? 'text-[#F5BE3A]' : 'text-white/40'} />
              <span className={`text-[10px] font-bold ${stockSubTab === id ? 'text-[#F5BE3A]' : 'text-white/40'}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
