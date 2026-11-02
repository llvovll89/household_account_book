import type { ParsedRow } from './bankParser'
type Matchable = Pick<ParsedRow, 'date' | 'amount' | 'type' | 'description'>
const descriptionKey = (description: string) => description.normalize('NFC').trim().replace(/\s+/g, ' ')
const baseKey = (row: Matchable) => JSON.stringify([row.date, row.amount, row.type])
const exactKey = (row: Matchable) => JSON.stringify([row.date, row.amount, row.type, descriptionKey(row.description)])

/** Consume existing matches one-for-one; repeated payments are not all the same transaction. */
export function classifyImportDuplicates(rows: Matchable[], existing: Matchable[]) {
  const available = new Map<string, number>()
  const existingDatesAndAmounts = new Set(existing.map(baseKey))
  for (const row of existing) {
    if (!descriptionKey(row.description)) continue
    available.set(exactKey(row), (available.get(exactKey(row)) ?? 0) + 1)
  }
  const fileCounts = new Map<string, number>()
  rows.forEach(row => fileCounts.set(exactKey(row), (fileCounts.get(exactKey(row)) ?? 0) + 1))
  return rows.map(row => {
    const description = descriptionKey(row.description)
    const key = exactKey(row)
    const count = description ? available.get(key) ?? 0 : 0
    if (count > 0) {
      available.set(key, count - 1)
      return { isDuplicate: true, reviewReasons: [] as string[] }
    }
    const reviewReasons: string[] = []
    if (!description && existingDatesAndAmounts.has(baseKey(row))) reviewReasons.push('적요 없는 기존 내역과 비교 필요')
    if ((fileCounts.get(key) ?? 0) > 1) reviewReasons.push('파일 안의 같은 날짜·금액·적요 확인')
    return { isDuplicate: false, reviewReasons }
  })
}
