import type { StockTrade } from '../../types'
import type { StockSubTab } from '../../types/navigation'
import StockPortfolio from '../StockPortfolio'
import StockWatchlist from '../StockWatchlist'
import StockTradeList from '../StockTradeList'
import StockPerformance from '../StockPerformance'

interface Props {
  stockSubTab: StockSubTab
  stockTrades: StockTrade[]
  stockWatchlist: string[]
  onStockSubTabChange: (tab: StockSubTab) => void
  onTradeEdit: (trade: StockTrade) => void
  onTradeDelete: (id: string) => void
  onWatchAdd: (ticker: string) => void
  onWatchRemove: (ticker: string) => void
}

export default function StocksWorkspace({
  stockSubTab,
  stockTrades,
  stockWatchlist,
  onStockSubTabChange,
  onTradeEdit,
  onTradeDelete,
  onWatchAdd,
  onWatchRemove,
}: Props) {
  return (
    <>
      <div className="bg-[#1E2236] rounded-2xl p-1 flex gap-1 mb-3">
        <button
          onClick={() => onStockSubTabChange('portfolio')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${stockSubTab === 'portfolio' ? 'bg-[#F5BE3A] text-[#0D0F14]' : 'text-[#8B95A1]'}`}
        >
          포트폴리오
        </button>
        <button
          onClick={() => onStockSubTabChange('watchlist')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${stockSubTab === 'watchlist' ? 'bg-[#F5BE3A] text-[#0D0F14]' : 'text-[#8B95A1]'}`}
        >
          관심
        </button>
        <button
          onClick={() => onStockSubTabChange('trades')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${stockSubTab === 'trades' ? 'bg-[#F5BE3A] text-[#0D0F14]' : 'text-[#8B95A1]'}`}
        >
          내역
        </button>
        <button
          onClick={() => onStockSubTabChange('performance')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${stockSubTab === 'performance' ? 'bg-[#F5BE3A] text-[#0D0F14]' : 'text-[#8B95A1]'}`}
        >
          성과
        </button>
      </div>

      {stockSubTab === 'portfolio' && (
        <StockPortfolio
          trades={stockTrades}
          onEdit={onTradeEdit}
          onDelete={onTradeDelete}
        />
      )}
      {stockSubTab === 'watchlist' && (
        <StockWatchlist
          trades={stockTrades}
          watchlist={stockWatchlist}
          onAdd={onWatchAdd}
          onRemove={onWatchRemove}
        />
      )}
      {stockSubTab === 'trades' && (
        <StockTradeList
          trades={stockTrades}
          onEdit={onTradeEdit}
          onDelete={onTradeDelete}
        />
      )}
      {stockSubTab === 'performance' && <StockPerformance trades={stockTrades} />}
    </>
  )
}
