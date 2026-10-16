import type { ComponentType } from 'react'
import type { Tab } from '../../types/navigation'
import BrandMark from '../ui/BrandMark'

interface LedgerTabItem {
  id: Tab
  label: string
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface Props {
  ledgerTabs: LedgerTabItem[]
  activeTab: Tab
  onLedgerTabChange: (tab: Tab) => void
  onLedgerTabHover?: (tab: Tab) => void
}

export default function BottomNavigation({
  ledgerTabs,
  activeTab,
  onLedgerTabChange,
  onLedgerTabHover,
}: Props) {
  return (
    <nav aria-label="가계부 메뉴" className="ledger-navigation">
      <div className="ledger-navigation-surface">
        <div className="ledger-navigation-brand"><BrandMark /><span className="brand-wordmark">잔고플랜</span></div>
        <p className="ledger-navigation-caption">매일의 기록, 가벼운 돈 관리</p>
        <div className="ledger-navigation-items pb-safe">
          {ledgerTabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                type="button"
                key={id}
                onClick={() => onLedgerTabChange(id)}
                onMouseEnter={() => onLedgerTabHover?.(id)}
                onFocus={() => onLedgerTabHover?.(id)}
                onTouchStart={() => onLedgerTabHover?.(id)}
                aria-label={`${label === '내역' ? '거래 내역' : label} 탭`}
                aria-current={isActive ? 'page' : undefined}
                className={`ledger-navigation-item ${isActive ? 'is-active' : ''}`}
              >
                <div className={`flex items-center justify-center w-7 h-7 transition-colors duration-200`}>
                  <Icon size={20} strokeWidth={1.7} className={`transition-colors duration-150 ${isActive ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`} />
                </div>
                <span className="ledger-navigation-label">{label === '내역' ? '거래 내역' : label}</span>
              </button>
            )
          })}
        </div>
        <p className="ledger-navigation-footer">차곡차곡 쌓이는 나의 금융 기록</p>
      </div>
    </nav>
  )
}
