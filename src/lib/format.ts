/** 숫자를 한국 로케일 문자열로 변환 (예: 1234567 → "1,234,567") */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

/** YYYY-MM-DD를 로컬 시간대 기준 Date로 변환 */
export function parseYmdLocal(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return new Date(`${dateStr}T00:00:00`)

  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  return new Date(year, month - 1, day)
}

/** 숫자를 축약 표기로 변환 (예: 15000000 → "1500만", 1000000000 → "10.0억") */
export function fmtShort(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return n.toLocaleString()
}

/** 주식 수량 표기 (정수는 그대로, 소수는 최대 4자리) */
export function fmtQty(q: number): string {
  return q % 1 === 0 ? q.toFixed(0) : q.toFixed(4).replace(/\.?0+$/, '')
}

/** 날짜 문자열(YYYY-MM-DD)을 표시용 문자열로 변환 */
export function formatDate(dateStr: string): string {
  const d = parseYmdLocal(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const wd = weekdays[d.getDay()]
  if (d.toDateString() === today.toDateString()) return `오늘 (${wd})`
  if (d.toDateString() === yesterday.toDateString()) return `어제 (${wd})`
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${wd})`
}

/** 통화별 가격 포맷 (KRW: 정수 + 원, USD: $ + 소수점 2자리) */
export function fmtPrice(price: number, currency: string): string {
  if (currency === 'KRW') return `${Math.round(price).toLocaleString('ko-KR')}원`
  if (currency === 'USD') return `$${price.toFixed(2)}`
  return `${price.toFixed(2)} ${currency}`
}

/** 로컬 날짜를 YYYY-MM-DD 문자열로 반환 (toISOString은 UTC 기준이라 한국 시간과 어긋날 수 있음) */
export function toLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 고유 ID 생성 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
