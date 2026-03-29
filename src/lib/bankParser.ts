import Papa from 'papaparse'

export interface ParsedRow {
  date: string        // YYYY-MM-DD
  description: string
  amount: number
  type: 'income' | 'expense'
}

export interface ColumnMapping {
  date: string
  deposit: string     // 입금 컬럼명 (없으면 '')
  withdrawal: string  // 출금 컬럼명 (없으면 '')
  amount: string      // 단일 금액 컬럼명 (deposit/withdrawal 없을 때)
  typeCol: string     // 입출금 구분 컬럼명 (없으면 '')
  description: string
}

// ────────────────────────────────────────────
//  컬럼 헤더 패턴 (정규화 후 매칭)
// ────────────────────────────────────────────
const DATE_PATTERNS = /^(거래일자|거래일시|거래일|날짜|일자|transaction.*date|date)/i
const DEPOSIT_PATTERNS = /^(입금|입금액|입금금액|맡기신금액|입금\(원\)|입금액\(원\)|credit)/i
const WITHDRAWAL_PATTERNS = /^(출금|출금액|출금금액|찾으신금액|출금\(원\)|출금액\(원\)|debit)/i
const AMOUNT_PATTERNS = /^(거래금액|금액|amount)/i
const TYPE_PATTERNS = /^(구분|거래구분|입출금구분|type)/i
const DESC_PATTERNS = /^(적요|기재내용|거래내용|내용|메모|거래메모|적요내용|summary|description|remarks)/i

function normalize(s: string) {
  return s.trim().replace(/\s+/g, '').replace(/[()（）원]/g, '')
}

export function detectColumns(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {
    date: '', deposit: '', withdrawal: '', amount: '', typeCol: '', description: '',
  }
  for (const h of headers) {
    const n = normalize(h)
    if (!mapping.date && DATE_PATTERNS.test(n)) mapping.date = h
    else if (!mapping.deposit && DEPOSIT_PATTERNS.test(n)) mapping.deposit = h
    else if (!mapping.withdrawal && WITHDRAWAL_PATTERNS.test(n)) mapping.withdrawal = h
    else if (!mapping.amount && AMOUNT_PATTERNS.test(n)) mapping.amount = h
    else if (!mapping.typeCol && TYPE_PATTERNS.test(n)) mapping.typeCol = h
    else if (!mapping.description && DESC_PATTERNS.test(n)) mapping.description = h
  }
  return mapping
}

// ────────────────────────────────────────────
//  날짜 정규화  →  YYYY-MM-DD
// ────────────────────────────────────────────
function parseDate(raw: string): string {
  const s = raw.trim().replace(/[.\/\s]/g, '-').replace(/[^0-9\-]/g, '')
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  // YYYY-MM-DD (already)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // YY-MM-DD
  if (/^\d{2}-\d{2}-\d{2}$/.test(s)) return `20${s}`
  return s.slice(0, 10)
}

// ────────────────────────────────────────────
//  금액 정규화
// ────────────────────────────────────────────
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

// ────────────────────────────────────────────
//  설명 기반 자동 카테고리 추천
// ────────────────────────────────────────────
const CATEGORY_KEYWORDS: [string, string[]][] = [
  ['식비', ['편의점', 'gs25', 'cu', 'seven', '세븐', '카페', '스타벅스', '이디야', '맥도날드',
            '버거킹', '롯데리아', '배달', '배민', '요기요', '쿠팡이츠', '마트', '이마트',
            '홈플러스', '롯데마트', '수퍼', '슈퍼', '식당', '음식', '치킨', '피자']],
  ['교통비', ['버스', '지하철', '철도', 'korail', 'ktx', '택시', '카카오T', '우버',
              '주유', '주차', 't머니', '교통', '고속도로']],
  ['주거비', ['월세', '관리비', '전기', '가스', '수도', '아파트', '오피스텔', '렌트']],
  ['통신비', ['sk텔레콤', 'kt', 'lg유플러스', '통신', '인터넷', '모바일', '핸드폰', '핸드폰']],
  ['의료비', ['병원', '의원', '약국', '약', '의료', '치과', '한의원', '보건']],
  ['쇼핑', ['쿠팡', '마켓컬리', '11번가', 'g마켓', '옥션', '위메프', '티몬', '백화점',
            '올리브영', '다이소', '의류', '패션']],
  ['문화/여가', ['넷플릭스', '유튜브', '왓챠', '웨이브', '영화', 'cgv', '롯데시네마', '메가박스',
                '게임', '스팀', '헬스', '수영', '독서실']],
  ['교육', ['학원', '교육', '도서', '책', '강의', '과외', '인강']],
  ['저축', ['적금', '저축', '펀드', '보험', 'isa']],
  ['급여', ['급여', '월급', '임금', '봉급']],
]

export function guessCategory(description: string, type: 'income' | 'expense'): string {
  const lower = description.toLowerCase()
  if (type === 'income') {
    for (const [cat, keywords] of CATEGORY_KEYWORDS) {
      if (keywords.some((k) => lower.includes(k))) return cat
    }
    return '기타수입'
  }
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return cat
  }
  return '기타지출'
}

// ────────────────────────────────────────────
//  CSV 파싱 → ParsedRow[]
// ────────────────────────────────────────────
export async function parseCSV(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(result) {
        const headers = result.meta.fields ?? []
        resolve({ headers, rows: result.data })
      },
      error(err) {
        reject(err)
      },
    })
  })
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): ParsedRow[] {
  const results: ParsedRow[] = []

  for (const row of rows) {
    const dateRaw = row[mapping.date] ?? ''
    if (!dateRaw.trim()) continue

    const date = parseDate(dateRaw)
    if (!date || date === 'NaN-Na-Na') continue

    const description = (row[mapping.description] ?? '').trim()

    let amount = 0
    let type: 'income' | 'expense' = 'expense'

    if (mapping.deposit && mapping.withdrawal) {
      // 입금/출금 컬럼 분리형
      const dep = parseAmount(row[mapping.deposit] ?? '')
      const wit = parseAmount(row[mapping.withdrawal] ?? '')
      if (dep > 0) { amount = dep; type = 'income' }
      else if (wit > 0) { amount = wit; type = 'expense' }
      else continue
    } else if (mapping.amount) {
      // 단일 금액 + 구분 컬럼
      amount = parseAmount(row[mapping.amount] ?? '')
      if (amount === 0) continue
      if (mapping.typeCol) {
        const t = (row[mapping.typeCol] ?? '').trim()
        type = /입금|credit|수입|입/i.test(t) ? 'income' : 'expense'
      }
    } else {
      continue
    }

    results.push({ date, description, amount, type })
  }

  return results
}

// ────────────────────────────────────────────
//  PDF 텍스트 추출 (best-effort)
// ────────────────────────────────────────────
export async function extractPDFText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  // CDN worker (Vite 빌드 없이 사용 가능)
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .filter((item): item is { str: string; transform: number[] } => 'str' in item)
      .sort((a, b) => {
        const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5])
        return yDiff !== 0 ? yDiff : a.transform[4] - b.transform[4]
      })
      .map((item) => item.str)
      .join(' ')
    fullText += pageText + '\n'
  }
  return fullText
}

// PDF 텍스트에서 거래 행 파싱 (best-effort 정규식)
export function parsePDFText(text: string): ParsedRow[] {
  const results: ParsedRow[] = []
  // YYYY.MM.DD 또는 YYYY-MM-DD 또는 YYYY/MM/DD 로 시작하는 행 찾기
  const lines = text.split('\n')
  const dateRe = /(\d{4}[.\-\/]\d{2}[.\-\/]\d{2})/
  const amountRe = /([0-9,]{3,})/g

  for (const line of lines) {
    const dateMatch = line.match(dateRe)
    if (!dateMatch) continue
    const date = parseDate(dateMatch[1])

    const amounts = [...line.matchAll(amountRe)]
      .map((m) => parseAmount(m[1]))
      .filter((n) => n > 0)

    if (amounts.length < 1) continue

    // 휴리스틱: 첫 번째 큰 금액을 사용
    const amount = amounts[0]
    // 간단한 수입/지출 판별 (입금 키워드 있으면 수입)
    const type: 'income' | 'expense' = /입금|수입|급여/.test(line) ? 'income' : 'expense'

    // 날짜와 숫자를 제거한 나머지를 설명으로
    const description = line
      .replace(dateRe, '')
      .replace(/[0-9,]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30)

    results.push({ date, description, amount, type })
  }

  return results
}
