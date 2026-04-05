import { useMemo } from 'react'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import type { StockTrade } from '../../types'
import type { StockSubTab } from '../../types/navigation'
import { calcHoldings } from '../../lib/stockCalc'
import useStockPrice from '../../hooks/useStockPrice'
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
  // 보유 종목 + 관심 종목 티커 전체 수집 (중복 제거)
  const allTickers = useMemo(() => {
    const holdingTickers = calcHoldings(stockTrades).map(h => h.ticker)
    return [...new Set([...holdingTickers, ...stockWatchlist])]
  }, [stockTrades, stockWatchlist])

  const { prices, loading, error, lastUpdated, refresh } = useStockPrice(allTickers)

  // 마지막 업데이트 시각 포맷 (HH:MM:SS)
  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <>
      {/* 탭 네비게이션 */}
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

      {/* 실시간 시세 상태 바 */}
      {allTickers.length > 0 && (
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            {error ? (
              <WifiOff size={11} className="text-[#F25260]" />
            ) : loading ? (
              <div className="w-2 h-2 rounded-full bg-[#F5BE3A] animate-pulse" />
            ) : (
              <Wifi size={11} className="text-[#2ACF6A]" />
            )}
            <span className="text-[10px] text-[#4E5968]">
              {error
                ? '시세 오류'
                : loading
                ? '시세 불러오는 중...'
                : lastUpdatedStr
                ? `${lastUpdatedStr} 업데이트`
                : '시세 대기 중'}
            </span>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] text-[#4E5968] hover:text-white transition-colors disabled:opacity-40"
            aria-label="시세 새로고침"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      )}

      {/* 서브 탭 컨텐츠 */}
      {stockSubTab === 'portfolio' && (
        <StockPortfolio
          trades={stockTrades}
          prices={prices}
          onEdit={onTradeEdit}
          onDelete={onTradeDelete}
        />
      )}
      {stockSubTab === 'watchlist' && (
        <StockWatchlist
          trades={stockTrades}
          watchlist={stockWatchlist}
          prices={prices}
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
