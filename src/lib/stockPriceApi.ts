/**
 * Yahoo Finance v7 Quote API 클라이언트
 *
 * CORS 처리:
 *  - 개발(DEV): Vite 프록시 /yf-api → query1.finance.yahoo.com
 *  - 프로덕션:  VITE_CORS_PROXY 환경변수 (기본값: https://corsproxy.io/?)
 *
 * 한국 종목코드 자동 변환:
 *  - 6자리 숫자 → {code}.KS (KOSPI 기본)
 *  - 직접 입력: 005930.KS (KOSPI), 035420.KQ (KOSDAQ)
 */

export interface StockQuote {
  symbol: string       // Yahoo Finance 심볼 (예: 005930.KS)
  ticker: string       // 사용자가 입력한 원본 티커
  currentPrice: number
  prevClose: number
  change: number       // 전일 대비 절대값
  changePct: number    // 전일 대비 퍼센트
  currency: string     // 'KRW' | 'USD' 등
  marketState: string  // 'REGULAR' | 'PRE' | 'POST' | 'CLOSED'
  shortName: string    // 종목 이름 (Yahoo Finance 제공)
  lastUpdated: number  // timestamp
}

/**
 * 티커 문자열을 Yahoo Finance 심볼로 변환
 * - 6자리 숫자: 한국 KOSPI 종목 (예: "005930" → "005930.KS")
 * - 이미 접미사 포함: 그대로 사용 (예: "035420.KQ")
 * - 나머지: 대문자 변환 (미국 주식 등)
 */
export function toYahooSymbol(ticker: string): string {
  const t = ticker.trim()
  if (/^\d{6}$/.test(t)) return `${t}.KS`
  return t.toUpperCase()
}

function buildUrl(yahoPath: string): string {
  if (import.meta.env.DEV) {
    return `/yf-api${yahoPath}`
  }
  const proxy = (import.meta.env.VITE_CORS_PROXY as string | undefined) ?? 'https://corsproxy.io/?'
  return `${proxy}${encodeURIComponent(`https://query1.finance.yahoo.com${yahoPath}`)}`
}

// ─── 차트 데이터 ────────────────────────────────────────────────

export type ChartRange = '1d' | '5d' | '1mo' | '3mo' | '1y'

export const RANGE_CONFIG: Record<ChartRange, { interval: string; pollMs: number }> = {
  '1d':  { interval: '2m',  pollMs: 60_000 },
  '5d':  { interval: '5m',  pollMs: 120_000 },
  '1mo': { interval: '1h',  pollMs: 300_000 },
  '3mo': { interval: '1d',  pollMs: 300_000 },
  '1y':  { interval: '1d',  pollMs: 300_000 },
}

export interface ChartPoint {
  timestamp: number
  time: string   // X축 표시용 포맷
  price: number
}

export interface StockChartData {
  symbol: string
  currency: string
  prevClose: number
  points: ChartPoint[]
}

function formatTimestamp(tsSeconds: number, range: ChartRange): string {
  const d = new Date(tsSeconds * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (range === '1d') return `${hh}:${mm}`
  if (range === '5d') return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * Yahoo Finance v8 Chart API로 가격 히스토리를 가져옴
 */
export async function fetchChart(ticker: string, range: ChartRange): Promise<StockChartData> {
  const symbol = toYahooSymbol(ticker)
  const { interval } = RANGE_CONFIG[range]

  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`

  const res = await fetch(buildUrl(path), {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`차트 데이터 오류: HTTP ${res.status}`)

  const data: any = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('차트 데이터 없음')

  const timestamps: number[] = result.timestamp ?? []
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
  const currency: string = result.meta?.currency ?? 'KRW'
  const prevClose: number =
    result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? 0

  const points: ChartPoint[] = timestamps
    .map((ts, i) => ({ ts, close: closes[i] }))
    .filter(({ close }) => close != null && !isNaN(close as number))
    .map(({ ts, close }) => ({
      timestamp: ts,
      time: formatTimestamp(ts, range),
      price: close as number,
    }))

  return { symbol, currency, prevClose, points }
}

// ─── Quote 데이터 ────────────────────────────────────────────────

/**
 * Yahoo Finance에서 주어진 티커 목록의 시세를 가져옴
 * @returns ticker → StockQuote 맵 (조회 실패 티커는 포함되지 않음)
 */
export async function fetchQuotes(tickers: string[]): Promise<Record<string, StockQuote>> {
  if (tickers.length === 0) return {}

  // 원본 티커 → Yahoo 심볼 매핑 (역방향도 보관)
  const symbolToTicker: Record<string, string> = {}
  const ySymbols = tickers.map(t => {
    const sym = toYahooSymbol(t)
    symbolToTicker[sym] = t
    return sym
  })
  const symbolsParam = ySymbols.join(',')

  const fields = [
    'regularMarketPrice',
    'regularMarketPreviousClose',
    'regularMarketChange',
    'regularMarketChangePercent',
    'currency',
    'marketState',
    'shortName',
  ].join(',')

  const path =
    `/v7/finance/quote` +
    `?symbols=${encodeURIComponent(symbolsParam)}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&lang=ko-KR` +
    `&corsDomain=finance.yahoo.com`

  const res = await fetch(buildUrl(path), {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Yahoo Finance API 오류: HTTP ${res.status}`)
  }

  const data: unknown = await res.json()
  const results: any[] = (data as any)?.quoteResponse?.result ?? []

  const quotes: Record<string, StockQuote> = {}
  for (const r of results) {
    const originalTicker = symbolToTicker[r.symbol] ?? r.symbol
    quotes[originalTicker] = {
      symbol: r.symbol,
      ticker: originalTicker,
      currentPrice: r.regularMarketPrice ?? 0,
      prevClose: r.regularMarketPreviousClose ?? 0,
      change: r.regularMarketChange ?? 0,
      changePct: r.regularMarketChangePercent ?? 0,
      currency: r.currency ?? 'KRW',
      marketState: r.marketState ?? 'CLOSED',
      shortName: r.shortName ?? originalTicker,
      lastUpdated: Date.now(),
    }
  }

  return quotes
}
