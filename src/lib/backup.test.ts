import { expect, it } from 'vitest'
import { createBackup, parseBackup, validateBackupData } from './backup'
import { backupFixture } from '../test/backupFixture'


it('round-trips every collection, setting and optional record field', () => {
  const data = backupFixture()
  expect(parseBackup(createBackup(data)).data).toEqual(data)
  data.transactions[0].receiptImageUrl = ''
  data.recurring[0].lastAppliedDate = ''
  expect(parseBackup(`\uFEFF${createBackup(data)}`).data).toEqual(data)
})

it('rejects incomplete files, unsupported versions, invalid JSON and oversized input', () => {
  const file = JSON.parse(createBackup(backupFixture()))
  expect(() => parseBackup('{')).toThrow('JSON')
  expect(() => parseBackup(JSON.stringify({ ...file, version: 2 }))).toThrow('버전')
  delete file.data.goals
  expect(() => parseBackup(JSON.stringify(file))).toThrow('data.goals')
  expect(() => parseBackup('x'.repeat(10 * 1024 * 1024 + 1))).toThrow('10MB')
})

it.each(['2026-02-30', '2026-13-01', '2026-11-02x', '0000-01-01'])('rejects invalid calendar date %s', date => {
  const data = backupFixture(); data.transactions[0].date = date
  expect(() => validateBackupData(data)).toThrow('date')
})

it('rejects duplicate IDs or category/month budgets and invalid numeric/enumerated values', () => {
  const duplicate = backupFixture(); duplicate.transactions.push(duplicate.transactions[0])
  expect(() => validateBackupData(duplicate)).toThrow('중복')
  const budget = backupFixture(); budget.budgets.push(budget.budgets[0])
  expect(() => validateBackupData(budget)).toThrow('중복')
  for (const amount of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 0.5]) {
    const data = backupFixture(); data.transactions[0].amount = amount
    expect(() => validateBackupData(data)).toThrow('amount')
  }
  const data = backupFixture()
  expect(() => validateBackupData({ ...data, settings: { ...data.settings, swipeSensitivity: 'invalid' } })).toThrow('swipeSensitivity')
  data.budgets[0].yearMonth = '2026-00'
  expect(() => validateBackupData(data)).toThrow('yearMonth')
})

it('reconstructs whitelisted fields without importing account or storage metadata', () => {
  const data = backupFixture()
  expect(validateBackupData({ ...data, uid: 'other-user', settings: { ...data.settings, token: 'secret' } })).toEqual(data)
  data.transactions[0].receiptImageUrl = 'javascript:alert(1)'
  expect(() => validateBackupData(data)).toThrow('receiptImageUrl')
})
