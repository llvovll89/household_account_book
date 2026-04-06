import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { StockTrade, StockTradeType } from '../types'
import FancyDatePicker from './FancyDatePicker'

interface Props {
  trade?: StockTrade | null
  onSave: (data: Omit<StockTrade, 'id' | 'createdAt'>) => void
  onClose: () => void
}

const CURRENCIES = ['KRW', 'USD', 'JPY']

export default function StockTradeModal({ trade, onSave, onClose }: Props) {
  const tickerRef = useRef<HTMLInputElement>(null)
  const [tradeType, setTradeType] = useState<StockTradeType>('buy')
  const [ticker, setTicker] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [fee, setFee] = useState('0')
  const [currency, setCurrency] = useState('KRW')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (trade) {
      setTradeType(trade.tradeType)
      setTicker(trade.ticker)
      setDate(trade.date)
      setPrice(trade.price.toLocaleString())
      setQuantity(String(trade.quantity))
      setFee(trade.fee.toLocaleString())
      setCurrency(trade.currency)
      setNote(trade.note)
    }
    // focus on ticker input after mount
    setTimeout(() => tickerRef.current?.focus(), 100)
  }, [trade])

  function handlePriceChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setPrice(digits ? Number(digits).toLocaleString() : '')
  }

  function handleFeeChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setFee(digits ? Number(digits).toLocaleString() : '0')
  }

  const parsedPrice = parseInt(price.replace(/,/g, ''), 10) || 0
  const parsedQty = parseFloat(quantity) || 0
  const parsedFee = parseInt(fee.replace(/,/g, ''), 10) || 0
  const totalAmount = parsedPrice * parsedQty + parsedFee

  function fmtQty(q: number) {
    return q % 1 === 0 ? q.toFixed(0) : q.toString()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ticker.trim() || parsedPrice <= 0 || parsedQty <= 0) return
    onSave({
      tradeType,
      ticker: ticker.trim(),
      date,
      price: parsedPrice,
      quantity: parsedQty,
      fee: parsedFee,
      currency,
      note: note.trim(),
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] border-t border-white/6">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-2 pb-4">
          <h2 className="text-[18px] font-bold text-white">
            {trade ? '거래 수정' : '거래 추가'}
          </h2>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-3">
          {/* 매수 / 매도 */}
          <div role="group" aria-label="거래 유형" className="flex gap-2 bg-[#252A3F] p-1 rounded-2xl">
            <button type="button" onClick={() => setTradeType('buy')}
              aria-pressed={tradeType === 'buy'}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tradeType === 'buy' ? 'bg-[#3D8EF8]/20 text-[#3D8EF8]' : 'text-[#4E5968]'
              }`}>
              매수
            </button>
            <button type="button" onClick={() => setTradeType('sell')}
              aria-pressed={tradeType === 'sell'}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tradeType === 'sell' ? 'bg-[#F25260]/20 text-[#F25260]' : 'text-[#4E5968]'
              }`}>
              매도
            </button>
          </div>

          {/* 종목명 */}
          <div className="bg-[#252A3F] rounded-2xl px-5 py-4">
            <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">종목명</p>
            <input
              ref={tickerRef}
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="삼성전자, AAPL"
              required
              className="w-full bg-transparent text-[16px] font-bold text-white placeholder-[#2D3352] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 날짜 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">날짜</p>
              <FancyDatePicker value={date} onChange={setDate} />
            </div>

            {/* 통화 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">통화</p>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-transparent text-[14px] font-bold text-white focus:outline-none appearance-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-[#252A3F] text-white">{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 주당 단가 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">주당 단가</p>
              <div className="flex items-baseline gap-1">
                <input
                  type="text" inputMode="numeric"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="0"
                  required
                  className="flex-1 min-w-0 bg-transparent text-[16px] font-bold text-white placeholder-[#2D3352] focus:outline-none num"
                />
                <span className="text-xs text-[#4E5968] shrink-0">{currency === 'KRW' ? '원' : currency}</span>
              </div>
            </div>

            {/* 수량 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">수량</p>
              <div className="flex items-baseline gap-1">
                <input
                  type="text" inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  required
                  className="flex-1 min-w-0 bg-transparent text-[16px] font-bold text-white placeholder-[#2D3352] focus:outline-none num"
                />
                <span className="text-xs text-[#4E5968] shrink-0">주</span>
              </div>
            </div>
          </div>

          {/* 수수료 */}
          <div className="bg-[#252A3F] rounded-2xl px-5 py-3.5">
            <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">수수료 (선택)</p>
            <div className="flex items-baseline gap-1">
              <input
                type="text" inputMode="numeric"
                value={fee}
                onChange={(e) => handleFeeChange(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-[14px] font-bold text-white focus:outline-none num"
              />
              <span className="text-xs text-[#4E5968] shrink-0">{currency === 'KRW' ? '원' : currency}</span>
            </div>
          </div>

          {/* 총 거래금액 */}
          {totalAmount > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-[#4E5968]">총 거래금액</span>
              <span className={`text-sm font-bold num ${tradeType === 'buy' ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                {totalAmount.toLocaleString()}{currency === 'KRW' ? '원' : ` ${currency}`}
                {parsedQty > 0 && (
                  <span className="text-xs text-[#4E5968] font-normal ml-1">
                    ({fmtQty(parsedQty)}주)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* 메모 */}
          <div className="bg-[#252A3F] rounded-2xl px-5 py-4">
            <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">메모 (선택)</p>
            <input
              type="text" value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="추가 메모"
              className="w-full bg-transparent text-[14px] font-medium text-white placeholder-[#2D3352] focus:outline-none"
            />
          </div>

          <button type="submit"
            className={`w-full py-4 rounded-2xl font-bold text-white text-[15px] transition-all active:scale-[0.98] ${
              tradeType === 'buy' ? 'bg-[#3D8EF8] hover:bg-[#5AA0FF]' : 'bg-[#F25260] hover:bg-[#FF6B78]'
            }`}>
            {trade ? '수정 완료' : tradeType === 'buy' ? '매수 추가' : '매도 추가'}
          </button>
        </form>
      </div>
    </div>
  )
}
