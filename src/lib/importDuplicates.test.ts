import { expect, it } from 'vitest'
import { classifyImportDuplicates } from './importDuplicates'
const row = (description: string, amount = 6500) => ({ description, amount, date: '2026-11-02', type: 'expense' as const })

it('keeps different merchants with the same date and amount, but matches the same description', () => {
  expect(classifyImportDuplicates([row('카페 B'), row(' 카페   A ')], [row('카페 A')]).map(result => result.isDuplicate)).toEqual([false, true])
})
it('consumes existing counts once and flags repeated file rows for explicit review', () => {
  const result = classifyImportDuplicates([row('카페'), row('카페')], [row('카페')])
  expect(result.map(item => item.isDuplicate)).toEqual([true, false])
  expect(result[1].reviewReasons).toHaveLength(1)
  expect(classifyImportDuplicates([row('카페'), row('카페')], []).every(item => !item.isDuplicate && item.reviewReasons.length > 0)).toBe(true)
})
it('never automatically excludes rows based on missing descriptions or cross-type matches', () => {
  expect(classifyImportDuplicates([row('')], [row('')])[0]).toMatchObject({ isDuplicate: false })
  expect(classifyImportDuplicates([row('')], [row('')])[0].reviewReasons).toHaveLength(1)
  expect(classifyImportDuplicates([{ ...row('카페'), type: 'income' }], [row('카페')])[0].isDuplicate).toBe(false)
})
