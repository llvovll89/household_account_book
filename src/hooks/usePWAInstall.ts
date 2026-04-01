import { useState, useEffect, useCallback, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const PWA_PROMPT_DISMISSED_KEY = 'pwa-install-prompt-dismissed'

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIosManualInstall, setIsIosManualInstall] = useState(false)
  const [installGuideText, setInstallGuideText] = useState('설치 버튼을 눌러 잔고플랜 앱을 설치할 수 있어요.')
  const hasInstallPromptRef = useRef(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY) === '1'
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (dismissed || isStandalone) return

    const ua = window.navigator.userAgent.toLowerCase()
    const isMobile = /android|iphone|ipad|ipod/.test(ua)
    const isIos = /iphone|ipad|ipod/.test(ua)
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua)
    const isIosChrome = /crios/.test(ua)
    const isIosEdge = /edgios/.test(ua)
    const isIosFirefox = /fxios/.test(ua)

    if (!isMobile) return

    if (isIos) {
      const iosGuideText = isSafari
        ? 'Safari 하단 공유 버튼 → 홈 화면에 추가'
        : isIosChrome
          ? 'Chrome 메뉴(⋯) → 홈 화면에 추가'
          : isIosEdge
            ? 'Edge 메뉴(⋯) → 휴대폰에 추가(홈 화면)'
            : isIosFirefox
              ? 'Firefox 메뉴(☰) → 홈 화면에 추가'
              : '브라우저 메뉴에서 홈 화면에 추가를 선택하세요.'
      setIsIosManualInstall(true)
      setInstallGuideText(iosGuideText)
      setShowInstallBanner(true)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      hasInstallPromptRef.current = true
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setIsIosManualInstall(false)
      setInstallGuideText('설치 버튼을 눌러 잔고플랜 앱을 설치할 수 있어요.')
      setShowInstallBanner(true)
    }

    const onInstalled = () => {
      setShowInstallBanner(false)
      setDeferredPrompt(null)
      localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, '1')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    const fallbackTimer = window.setTimeout(() => {
      if (!isIos && !hasInstallPromptRef.current) {
        setIsIosManualInstall(true)
        setInstallGuideText('브라우저 메뉴(⋮/⋯) → 홈 화면에 추가를 선택하세요.')
        setShowInstallBanner(true)
      }
    }, 2200)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const closeInstallBanner = useCallback(() => {
    setShowInstallBanner(false)
    localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, '1')
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setShowInstallBanner(false)
      localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, '1')
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  return { showInstallBanner, isIosManualInstall, installGuideText, deferredPrompt, closeInstallBanner, handleInstallClick }
}
