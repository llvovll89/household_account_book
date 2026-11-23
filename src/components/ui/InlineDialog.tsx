import type { ReactNode } from 'react'
import { useModalClose } from '../../hooks/useModalClose'

interface InlineDialogProps {
  onClose: () => void
  /** 스크린리더가 읽는 대화상자 이름 */
  label: string
  /** 화면 전체를 덮는 바깥 영역 (배경색·정렬) */
  containerClassName: string
  panelClassName?: string
  children: ReactNode
}

/**
 * 화면 안에서 조건부로 띄우는 시트·모달에 공통 모달 동작(포커스 가두기·Escape·스크롤 잠금·포커스 복귀)을 붙인다.
 * 별도 모달 파일로 빼지 않은 인라인 시트용이다.
 */
export function InlineDialog({ onClose, label, containerClassName, panelClassName = '', children }: InlineDialogProps) {
  // 인라인 시트는 닫힘 애니메이션이 없으므로 지연 없이 닫는다
  const { handleClose, modalRef } = useModalClose(onClose, { duration: 0 })
  return (
    <div className={containerClassName}>
      <div className="absolute inset-0" aria-hidden="true" onClick={handleClose} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={label} className={`relative ${panelClassName}`}>
        {children}
      </div>
    </div>
  )
}
