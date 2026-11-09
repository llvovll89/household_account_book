// Firebase 설정 - Firebase 프로젝트 생성 후 아래 주석을 해제하세요
//
import { getAnalytics, isSupported } from 'firebase/analytics'
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
// getAuth()와 같은 persistence 순서를 유지하되 popupRedirectResolver는 빼서,
// 시작 시 Google 로그인 iframe·gapi(외부 스크립트 3종)를 미리 받지 않는다. 팝업 로그인 시점에 넘긴다.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
})
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

function initAnalytics() {
  void isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app)
      }
    })
    .catch(() => {
      // Analytics is optional; initialization failures should not block app usage.
    })
}

if (typeof window !== 'undefined') {
  // gtag.js(약 160KB)가 첫 화면 로딩과 경쟁하지 않도록 load 이후 유휴 시간에 초기화
  const scheduleAnalytics = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(initAnalytics, { timeout: 5000 })
    else setTimeout(initAnalytics, 2000) // Safari 등 requestIdleCallback 미지원 브라우저
  }
  if (document.readyState === 'complete') scheduleAnalytics()
  else window.addEventListener('load', scheduleAnalytics, { once: true })
}
