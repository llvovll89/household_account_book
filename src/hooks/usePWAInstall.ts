import { useState, useEffect, useCallback, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
const LEGACY_DISMISSED_KEY = 'pwa-install-prompt-dismissed'
const SNOOZE_KEY = 'hb_install_snooze_until'
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}
function isSnoozed() {
  try { return localStorage.getItem(LEGACY_DISMISSED_KEY) === '1' || Number(localStorage.getItem(SNOOZE_KEY)) > Date.now() }
  catch { return false }
}
function snooze() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 86400000)) } catch { /* Installation remains optional. */ }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [installGuideText, setInstallGuideText] = useState('브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.')
  const installedRef = useRef(false)
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    installedRef.current = isStandalone()
    setCanInstall(!installedRef.current)
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setInstallGuideText(isIos
      ? '브라우저의 공유 또는 메뉴 → 홈 화면에 추가. 보이지 않으면 Safari에서 열어주세요.'
      : '브라우저 주소창의 설치 아이콘 또는 메뉴 → 앱 설치 / 홈 화면에 추가를 선택하세요.')
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (!installedRef.current) setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      installedRef.current = true
      setCanInstall(false)
      setShowInstallBanner(false)
      setDeferredPrompt(null)
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const offerInstallAfterSave = useCallback(() => {
    if (installedRef.current || isStandalone() || isSnoozed()) return
    if (offerTimerRef.current) clearTimeout(offerTimerRef.current)
    // Let save feedback finish before offering installation.
    offerTimerRef.current = setTimeout(() => {
      if (!installedRef.current && !isStandalone() && !isSnoozed()) setShowInstallBanner(true)
    }, 6500)
  }, [])
  const closeInstallBanner = useCallback(() => { setShowInstallBanner(false); snooze() }, [])
  const openInstallGuide = useCallback(() => {
    if (!installedRef.current && !isStandalone()) setShowInstallBanner(true)
  }, [])
  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) { openInstallGuide(); return }
    const prompt = deferredPrompt
    setDeferredPrompt(null)
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      setShowInstallBanner(false)
      if (choice.outcome === 'accepted') {
        installedRef.current = true
        setCanInstall(false)
      } else snooze()
    } catch { setShowInstallBanner(true) }
  }, [deferredPrompt, openInstallGuide])
  return { showInstallBanner, isIosManualInstall: !deferredPrompt, installGuideText, deferredPrompt, canInstall, closeInstallBanner, handleInstallClick, offerInstallAfterSave, openInstallGuide }
}
