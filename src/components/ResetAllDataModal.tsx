import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useModalClose } from '../hooks/useModalClose'

interface Props {
  isLoggedIn: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

const CONFIRM_WORD = '초기화'

export default function ResetAllDataModal({ isLoggedIn, onConfirm, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const canConfirm = input.trim() === CONFIRM_WORD && !busy

  async function handleConfirm() {
    if (!canConfirm) return
    setBusy(true)
    try {
      await onConfirm()
      handleClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="전부 초기화"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div ref={modalRef} className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] border-t border-white/6 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-5">
          <div>
            <h2 className="text-[18px] font-bold text-[#F25260]">전부 초기화</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">모든 데이터와 설정을 앱 최초 상태로 되돌려요</p>
          </div>
          <button aria-label="전부 초기화 닫기" onClick={handleClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-4">
          <div className="bg-[#F25260]/10 border border-[#F25260]/30 rounded-2xl px-4 py-3.5">
            <p className="text-sm font-semibold text-[#F25260] mb-1 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <p className="text-xs text-[#8B95A1]">
              거래내역, 메모, 예산, 반복거래, 구독, 목표는 물론 카테고리·결제수단·급여일 같은 설정까지
              {isLoggedIn ? ' 이 기기와 서버에 저장된 데이터가 모두' : ' 이 기기에 저장된 데이터가 모두'} 영구 삭제됩니다.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#8B95A1]">
              계속하려면 <span className="text-white font-bold">&quot;{CONFIRM_WORD}&quot;</span>를 입력하세요
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              className="mt-2 w-full bg-[#2C2C2E] rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#F25260]/50"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 py-3.5 rounded-2xl font-bold text-[#8B95A1] text-sm bg-[#2C2C2E]"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 py-3.5 rounded-2xl font-bold text-white text-sm bg-[#F25260] disabled:opacity-30 flex items-center justify-center gap-1.5"
            >
              {busy ? '초기화 중...' : '전부 초기화'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
