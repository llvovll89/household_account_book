import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { CreditCard, DatabaseBackup, FileDown, LogOut, Menu, Target, Trash2 } from 'lucide-react'

interface Props {
  user: User | null
  onOpenImport: () => void
  onOpenPaymentMethods: () => void
  onOpenAutoCategoryRules: () => void
  onOpenBackup: () => void
  onReset: () => void
  onLogout: () => void
  onLogin: () => void
  /** 메뉴 버튼에 손을 올리면 가져오기 모듈을 미리 받는다 */
  onPrefetchImport: () => void
}

const ITEM_CLASS = 'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left'

/** 헤더 오른쪽 메뉴(가져오기·결제수단·자동 분류·백업·초기화·로그아웃)와 로그인 버튼. App.tsx에서 옮겨 왔다 */
export function HeaderMenu({ user, onOpenImport, onOpenPaymentMethods, onOpenAutoCategoryRules, onOpenBackup, onReset, onLogout, onLogin, onPrefetchImport }: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  // 항목을 고르면 메뉴를 닫고 실행한다
  const select = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  const items = [
    { label: '가져오기', Icon: FileDown, onClick: onOpenImport },
    { label: '결제수단 관리', Icon: CreditCard, onClick: onOpenPaymentMethods },
    { label: '자동 분류 규칙', Icon: Target, onClick: onOpenAutoCategoryRules },
    { label: '백업·복원', Icon: DatabaseBackup, onClick: onOpenBackup },
  ]

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={onPrefetchImport}
          onFocus={onPrefetchImport}
          onTouchStart={onPrefetchImport}
          aria-label="메뉴"
          aria-expanded={open}
          className="w-8 h-8 rounded-xl bg-raised hover:bg-tone-hover transition-colors border border-[rgba(255,255,255,0.06)] flex items-center justify-center overflow-hidden"
        >
          {!user ? (
            <Menu size={14} className="text-muted" />
          ) : user.photoURL ? (
            <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-[12px] font-bold text-accent">{(user.email?.[0] ?? 'U').toUpperCase()}</span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-2xl bg-surface border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-black/40 overflow-hidden">
            {user && (
              <div className="px-3.5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-0.5">로그인 계정</p>
                <p className="text-[12px] font-semibold text-fg truncate">{user.email ?? '로그인 사용자'}</p>
              </div>
            )}
            <div className="p-1">
              {items.map(({ label, Icon, onClick }) => (
                <button key={label} onClick={select(onClick)} className={`${ITEM_CLASS} text-fg hover:bg-tone-chip`}>
                  <Icon size={14} className="text-muted" />
                  {label}
                </button>
              ))}
              <div className="my-1 h-px bg-[rgba(255,255,255,0.06)]" />
              <button onClick={select(onReset)} className={`${ITEM_CLASS} text-expense hover:bg-tone-red/10`}>
                <Trash2 size={14} className="text-expense" />
                전부 초기화
              </button>
              {user && (
                <button onClick={select(onLogout)} className={`${ITEM_CLASS} text-expense hover:bg-tone-red/10`}>
                  <LogOut size={14} />
                  로그아웃
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {!user && (
        <button
          aria-label="로그인 모달 열기"
          onClick={onLogin}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-income bg-tone-green/10 hover:bg-tone-green/20 transition-colors border border-tone-green/15"
        >
          로그인
        </button>
      )}
    </>
  )
}
