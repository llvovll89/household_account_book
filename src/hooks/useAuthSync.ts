import { useCallback, useEffect, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase/firebase'
import { hasLocalMigratableData, mergeLocalIntoFirebase, setStorageContext } from '../lib/storage'
import { showToast } from '../lib/toast'

interface UseAuthSyncParams {
  hydrateData: () => Promise<void>
}

interface UseAuthSyncResult {
  user: User | null
  authReady: boolean
  isSyncing: boolean
  settingsVersion: number
  showAuthModal: boolean
  authMode: 'login' | 'signup'
  email: string
  password: string
  authBusy: boolean
  setShowAuthModal: (value: boolean) => void
  setAuthMode: (value: 'login' | 'signup') => void
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  handleGoogleLogin: () => Promise<void>
  handleEmailAuth: () => Promise<void>
  handleLogout: () => Promise<void>
}

function getGoogleAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return '로그인에 실패했습니다. 다시 시도해주세요.'
  }

  switch (error.code) {
    case 'auth/unauthorized-domain':
      return '허용되지 않은 도메인입니다. Firebase Auth의 Authorized domains 설정을 확인해주세요.'
    case 'auth/operation-not-allowed':
      return 'Google 로그인이 비활성화되어 있습니다. Firebase Auth의 Sign-in method에서 Google을 활성화해주세요.'
    case 'auth/popup-blocked':
      return '브라우저가 팝업을 차단했습니다. 팝업 차단을 해제한 뒤 다시 시도해주세요.'
    case 'auth/popup-closed-by-user':
      return '로그인 창이 닫혀 로그인에 실패했습니다. 다시 시도해주세요.'
    default:
      return `로그인에 실패했습니다. (${error.code})`
  }
}

function getEmailAuthErrorMessage(error: unknown, mode: 'login' | 'signup'): string {
  if (!(error instanceof FirebaseError)) {
    return mode === 'signup' ? '회원가입에 실패했습니다.' : '이메일 로그인에 실패했습니다.'
  }

  switch (error.code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.'
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/user-not-found':
      return '등록되지 않은 이메일입니다.'
    case 'auth/wrong-password':
      return '비밀번호가 올바르지 않습니다.'
    case 'auth/user-disabled':
      return '비활성화된 계정입니다. 관리자에게 문의해주세요.'
    case 'auth/too-many-requests':
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.'
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.'
    case 'auth/operation-not-allowed':
      return mode === 'signup'
        ? '이메일 회원가입이 비활성화되어 있습니다. Firebase Auth 설정을 확인해주세요.'
        : '이메일 로그인이 비활성화되어 있습니다. Firebase Auth 설정을 확인해주세요.'
    default:
      return mode === 'signup'
        ? `회원가입에 실패했습니다. (${error.code})`
        : `이메일 로그인에 실패했습니다. (${error.code})`
  }
}

export function useAuthSync({ hydrateData }: UseAuthSyncParams): UseAuthSyncResult {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const hydrateWithGuard = async (failMessage: string) => {
      try {
        await hydrateData()
      } catch {
        showToast(failMessage)
      } finally {
        if (!cancelled) {
          setAuthReady(true)
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      setIsSyncing(false)

      if (!nextUser) {
        setStorageContext('local', null)
        setSettingsVersion((prev) => prev + 1)
        await hydrateWithGuard('로컬 데이터를 불러오지 못했습니다.')
        return
      }

      setStorageContext('firebase', nextUser.uid)
      setSettingsVersion((prev) => prev + 1)

      try {
        if (hasLocalMigratableData()) {
          const apply = window.confirm('로컬에 저장된 데이터를 Firebase 데이터와 병합할까요?\n확인을 누르면 병합 후 로컬 원본은 백업됩니다.')
          if (apply) {
            setIsSyncing(true)
            const result = await mergeLocalIntoFirebase()
            showToast(result.message)
          }
        }
      } catch {
        showToast('데이터 병합 중 오류가 발생했습니다.')
      } finally {
        setIsSyncing(false)
      }

      await hydrateWithGuard('Firebase 데이터를 불러오지 못했습니다.')
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [hydrateData])

  const handleGoogleLogin = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider)
      setShowAuthModal(false)
    } catch (error) {
      showToast(getGoogleAuthErrorMessage(error))
      console.error('Google login failed:', error)
    }
  }, [])

  const handleEmailAuth = useCallback(async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      showToast('이메일과 비밀번호를 입력해주세요.')
      return
    }
    if (password.length < 6) {
      showToast('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setAuthBusy(true)
    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password)
        showToast('회원가입이 완료되었습니다.')
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password)
        showToast('로그인되었습니다.')
      }
      setPassword('')
      setShowAuthModal(false)
    } catch (error) {
      showToast(getEmailAuthErrorMessage(error, authMode))
      console.error('Email auth failed:', error)
    } finally {
      setAuthBusy(false)
    }
  }, [authMode, email, password])

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth)
      showToast('로그아웃되었습니다. 로컬 모드로 전환합니다.')
    } catch {
      showToast('로그아웃에 실패했습니다. 다시 시도해주세요.')
    }
  }, [])

  return {
    user,
    authReady,
    isSyncing,
    settingsVersion,
    showAuthModal,
    authMode,
    email,
    password,
    authBusy,
    setShowAuthModal,
    setAuthMode,
    setEmail,
    setPassword,
    handleGoogleLogin,
    handleEmailAuth,
    handleLogout,
  }
}
