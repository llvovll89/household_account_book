import { afterEach, expect, it, vi } from 'vitest'
import { forgetImportMapping, loadImportMapping, saveImportMapping } from './importMappings'

const mapping = { date: 'date', amount: 'amount', description: 'memo', deposit: '', withdrawal: '', typeCol: '' }
const headers = ['date', 'amount', 'memo']
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

it('restores confirmed columns even after reordering headers, without matching different formats', () => {
  expect(saveImportMapping(headers, mapping)).toBe(true)
  expect(loadImportMapping(['memo', 'amount', 'date'])).toEqual(mapping)
  expect(loadImportMapping(['date', 'amount', 'other'])).toBeNull()
  expect(forgetImportMapping(headers)).toBe(true)
  expect(loadImportMapping(headers)).toBeNull()
})

it('ignores corrupt data and refuses missing or ambiguous columns', () => {
  localStorage.setItem('hb_import_mappings_v1', '{broken')
  expect(loadImportMapping(headers)).toBeNull()
  expect(saveImportMapping(headers, { ...mapping, date: 'missing' })).toBe(false)
  expect(saveImportMapping(headers, { ...mapping, amount: '' })).toBe(false)
  expect(saveImportMapping([...headers, 'date'], mapping)).toBe(false)
})

it('keeps the ten newest formats and degrades safely when storage is unavailable', () => {
  for (let i = 0; i < 11; i++) {
    vi.spyOn(Date, 'now').mockReturnValue(i)
    saveImportMapping([...headers, `extra-${i}`], mapping)
  }
  expect(loadImportMapping([...headers, 'extra-0'])).toBeNull()
  expect(loadImportMapping([...headers, 'extra-10'])).toEqual(mapping)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(saveImportMapping(headers, mapping)).toBe(false)
})
