import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BackupModal from './BackupModal'
import { createBackup, parseBackup } from '../lib/backup'
import { backupFixture } from '../test/backupFixture'
import { loadBackupState, restoreAllData } from '../lib/storage'

vi.mock('../lib/storage', () => ({ loadBackupState: vi.fn(), restoreAllData: vi.fn() }))
const preview = () => ({ data: { ...backupFixture(), transactions: [] }, target: '이 기기', token: { mode: 'local' as const, uid: null, localStamp: 'original' } })
beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadBackupState).mockResolvedValue(preview()); vi.mocked(restoreAllData).mockResolvedValue({ data: backupFixture(), cacheSaved: true }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function upload(content = createBackup(backupFixture())) {
  await waitFor(() => expect((screen.getByLabelText('백업 파일로 복원') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('백업 파일로 복원'), { target: { files: [new File([content], 'backup.json', { type: 'application/json' })] } })
}

it('previews all collections and settings without writing, and restores only after explicit replacement consent', async () => {
  const onRestored = vi.fn()
  render(createElement(BackupModal, { onClose: vi.fn(), onRestored, canRestore: () => true }))
  await upload()
  await screen.findByRole('table', { name: '현재 저장된 데이터와 백업 데이터 비교' })
  for (const name of ['거래 내역', '메모', '예산', '정기 내역', '구독', '저축 목표', '결제수단', '입력 템플릿', '자동 분류 규칙', '급여일', '카드 결제일', '스와이프 민감도']) expect(screen.getByRole('rowheader', { name })).toBeTruthy()
  const button = screen.getByRole('button', { name: '확인한 백업으로 전체 복원' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(restoreAllData).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(button)
  await waitFor(() => expect(onRestored).toHaveBeenCalledWith(backupFixture(), true))
  expect(restoreAllData).toHaveBeenCalledWith(backupFixture(), preview().token)
})

it('rejects invalid files and never attempts a restore', async () => {
  render(createElement(BackupModal, { onClose: vi.fn(), onRestored: vi.fn(), canRestore: () => true }))
  await upload('{broken')
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(restoreAllData).not.toHaveBeenCalled()
})

it('keeps the preview available after failure, clears consent, and does not report success', async () => {
  const onRestored = vi.fn()
  vi.mocked(restoreAllData).mockRejectedValue(new Error('다른 기기에서 데이터가 바뀌었어요.'))
  render(createElement(BackupModal, { onClose: vi.fn(), onRestored, canRestore: () => true }))
  await upload()
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '확인한 백업으로 전체 복원' }))
  expect((await screen.findByRole('alert')).textContent).toContain('바뀌었어요')
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  expect(onRestored).not.toHaveBeenCalled()
})

it('blocks replacement while application saves are pending', async () => {
  render(createElement(BackupModal, { onClose: vi.fn(), onRestored: vi.fn(), canRestore: () => false }))
  await upload()
  fireEvent.click(await screen.findByRole('checkbox'))
  expect((screen.getByRole('button', { name: '확인한 백업으로 전체 복원' }) as HTMLButtonElement).disabled).toBe(true)
  expect(restoreAllData).not.toHaveBeenCalled()
})

it('downloads a fresh complete snapshot and allows cancelling a preview without writing', async () => {
  const createObjectURL = vi.fn<(blob: Blob | MediaSource) => string>(() => 'blob:backup')
  const revokeObjectURL = vi.fn()
  const NativeURL = URL
  vi.stubGlobal('URL', class extends NativeURL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const onClose = vi.fn()
  render(createElement(BackupModal, { onClose, onRestored: vi.fn(), canRestore: () => true }))
  await waitFor(() => expect((screen.getByRole('button', { name: '전체 백업 다운로드' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '전체 백업 다운로드' }))
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
  expect(click).toHaveBeenCalledTimes(1)
  const blob = createObjectURL.mock.calls[0][0] as Blob
  const content = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob) })
  expect(parseBackup(content).data).toEqual(preview().data)
  await upload()
  await screen.findByRole('checkbox')
  fireEvent.click(screen.getByRole('button', { name: '백업·복원 닫기' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(restoreAllData).not.toHaveBeenCalled()
})
