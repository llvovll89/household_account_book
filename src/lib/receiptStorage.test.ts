import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../firebase/firebase', () => ({ storage: {} }))
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), deleteObject: vi.fn(), getDownloadURL: vi.fn() }))

import { uploadReceiptImage } from './receiptStorage'

afterEach(() => vi.unstubAllGlobals())

it('rejects instead of hanging when the image file cannot be read', async () => {
  class FailingReader {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL() { queueMicrotask(() => this.onerror?.()) }
  }
  vi.stubGlobal('FileReader', FailingReader)
  const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })
  await expect(uploadReceiptImage('uid', 'tx', file)).rejects.toThrow('영수증 업로드 실패')
})
