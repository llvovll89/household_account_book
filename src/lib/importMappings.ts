import type { ColumnMapping } from './bankParser'

const KEY = 'hb_import_mappings_v1'
const FIELDS: (keyof ColumnMapping)[] = ['date', 'deposit', 'withdrawal', 'amount', 'typeCol', 'description']
type Presets = Record<string, { mapping: ColumnMapping; updatedAt: number }>

function signature(headers: string[]) { return JSON.stringify([...headers].sort()) }

function read(): Presets {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Presets : {}
  } catch { return {} }
}

function isValid(headers: string[], value: unknown): value is ColumnMapping {
  if (!value || typeof value !== 'object' || new Set(headers).size !== headers.length) return false
  const mapping = value as ColumnMapping
  return FIELDS.every(field => typeof mapping[field] === 'string' && (!mapping[field] || headers.includes(mapping[field])))
    && !!mapping.date && !!(mapping.amount || mapping.deposit || mapping.withdrawal)
}

export function loadImportMapping(headers: string[]): ColumnMapping | null {
  const mapping = read()[signature(headers)]?.mapping
  return isValid(headers, mapping) ? { ...mapping } : null
}

/** Store column names only, never filenames, account details, or transaction rows. */
export function saveImportMapping(headers: string[], mapping: ColumnMapping): boolean {
  if (!isValid(headers, mapping)) return false
  try {
    const presets = read()
    presets[signature(headers)] = { mapping, updatedAt: Date.now() }
    const newest = Object.entries(presets).sort((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0)).slice(0, 10)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(newest)))
    return true
  } catch { return false }
}

export function forgetImportMapping(headers: string[]): boolean {
  try {
    const presets = read()
    delete presets[signature(headers)]
    localStorage.setItem(KEY, JSON.stringify(presets))
    return true
  } catch { return false }
}
