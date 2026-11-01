import type { TransactionType } from '../types'

export const pwaShortcuts = [
  { name: '지출 기록하기', short_name: '지출 기록', description: '지출 입력을 바로 열어요', url: '/?action=expense', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
  { name: '수입 기록하기', short_name: '수입 기록', description: '수입 입력을 바로 열어요', url: '/?action=income', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
]
export function consumeEntryShortcut(location: { href: string }, history: { state: unknown; replaceState: (data: unknown, unused: string, url: string) => void }): TransactionType | null {
  const url = new URL(location.href)
  const action = url.searchParams.get('action')
  if (action !== 'expense' && action !== 'income') return null
  url.searchParams.delete('action')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return action
}
