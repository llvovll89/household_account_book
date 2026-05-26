import { useState, useCallback } from 'react'

export function useModalClose(onClose: () => void, duration = 200) {
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, duration)
  }, [onClose, duration])

  return { closing, handleClose }
}
