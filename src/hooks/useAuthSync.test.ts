import { act, renderHook, waitFor } from '@testing-library/react'
import { FirebaseError } from 'firebase/app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  setStorageContextMock: vi.fn(),
  hasLocalMigratableDataMock: vi.fn(),
  getLocalDataCountsMock: vi.fn(),
  mergeLocalIntoFirebaseMock: vi.fn(),
  clearLocalDataMock: vi.fn(),
  onAuthStateChangedMock: vi.fn(),
  createUserWithEmailAndPasswordMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
  signInWithPopupMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('../lib/toast', () => ({
  showToast: mocks.showToastMock,
}))

vi.mock('../lib/storage', () => ({
  clearLocalData: mocks.clearLocalDataMock,
  getLocalDataCounts: mocks.getLocalDataCountsMock,
  hasLocalMigratableData: mocks.hasLocalMigratableDataMock,
  mergeLocalIntoFirebase: mocks.mergeLocalIntoFirebaseMock,
  setStorageContext: mocks.setStorageContextMock,
}))

vi.mock('../firebase/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {},
}))

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mocks.createUserWithEmailAndPasswordMock,
  onAuthStateChanged: mocks.onAuthStateChangedMock,
  signInWithEmailAndPassword: mocks.signInWithEmailAndPasswordMock,
  signInWithPopup: mocks.signInWithPopupMock,
  signOut: mocks.signOutMock,
}))

import { useAuthSync } from './useAuthSync'

describe('useAuthSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasLocalMigratableDataMock.mockReturnValue(false)
    mocks.getLocalDataCountsMock.mockReturnValue({ transactions: 0, memos: 0, budgets: 0, recurring: 0, stockTrades: 0 })
    mocks.mergeLocalIntoFirebaseMock.mockResolvedValue({ merged: true, message: 'ok', counts: { transactions: 0, memos: 0, budgets: 0, recurring: 0, stockTrades: 0 } })

    mocks.onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (u: unknown) => void) => {
      callback(null)
      return () => {}
    })
  })

  it('비로그인 상태에서는 로컬 모드로 전환하고 hydrateData를 호출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    expect(mocks.setStorageContextMock).toHaveBeenCalledWith('local', null)
    expect(hydrateData).toHaveBeenCalledTimes(1)
    expect(result.current.showMergeModal).toBe(false)
  })

  it('로그인 + 로컬 데이터 존재 시 병합 모달을 띄우고 카운트를 설정한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.hasLocalMigratableDataMock.mockReturnValue(true)
    mocks.getLocalDataCountsMock.mockReturnValue({ transactions: 5, memos: 1, budgets: 2, recurring: 0, stockTrades: 0 })

    mocks.onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (u: unknown) => void) => {
      callback({ uid: 'user-1' })
      return () => {}
    })

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
      expect(result.current.showMergeModal).toBe(true)
    })

    expect(mocks.setStorageContextMock).toHaveBeenCalledWith('firebase', 'user-1')
    expect(result.current.localDataCounts.transactions).toBe(5)
    expect(hydrateData).not.toHaveBeenCalled()
  })

  it('handleMergeConfirm은 병합 후 hydrateData를 호출하고 모달을 닫는다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.hasLocalMigratableDataMock.mockReturnValue(true)
    mocks.getLocalDataCountsMock.mockReturnValue({ transactions: 2, memos: 0, budgets: 0, recurring: 0, stockTrades: 0 })

    mocks.onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (u: unknown) => void) => {
      callback({ uid: 'user-1' })
      return () => {}
    })

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.showMergeModal).toBe(true)
    })

    await act(async () => {
      await result.current.handleMergeConfirm()
    })

    expect(mocks.mergeLocalIntoFirebaseMock).toHaveBeenCalledTimes(1)
    expect(hydrateData).toHaveBeenCalledTimes(1)
    expect(result.current.showMergeModal).toBe(false)
  })

  it('handleMergeCancel은 로컬 데이터를 정리하고 hydrateData를 호출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.hasLocalMigratableDataMock.mockReturnValue(true)
    mocks.getLocalDataCountsMock.mockReturnValue({ transactions: 3, memos: 1, budgets: 0, recurring: 0, stockTrades: 0 })

    mocks.onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (u: unknown) => void) => {
      callback({ uid: 'user-1' })
      return () => {}
    })

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.showMergeModal).toBe(true)
    })

    await act(async () => {
      await result.current.handleMergeCancel()
    })

    expect(mocks.clearLocalDataMock).toHaveBeenCalledTimes(1)
    expect(hydrateData).toHaveBeenCalledTimes(1)
    expect(result.current.showMergeModal).toBe(false)
  })

  it('handleEmailAuth는 이메일/비밀번호 누락 시 토스트를 노출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    await act(async () => {
      await result.current.handleEmailAuth()
    })

    expect(mocks.showToastMock).toHaveBeenCalledWith('이메일과 비밀번호를 입력해주세요.')
    expect(mocks.createUserWithEmailAndPasswordMock).not.toHaveBeenCalled()
    expect(mocks.signInWithEmailAndPasswordMock).not.toHaveBeenCalled()
  })

  it('회원가입 성공 시 로그아웃 후 로그인 모드로 전환한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.createUserWithEmailAndPasswordMock.mockResolvedValue({})
    mocks.signOutMock.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    await act(async () => {
      result.current.setAuthMode('signup')
      result.current.setEmail('new@user.com')
      result.current.setPassword('secret123')
    })

    await act(async () => {
      await result.current.handleEmailAuth()
    })

    expect(mocks.createUserWithEmailAndPasswordMock).toHaveBeenCalledTimes(1)
    expect(mocks.signOutMock).toHaveBeenCalledTimes(1)
    expect(result.current.authMode).toBe('login')
    expect(result.current.password).toBe('')
    expect(mocks.showToastMock).toHaveBeenCalledWith('회원가입이 완료되었습니다. 이제 로그인해주세요.')
  })

  it('이메일 로그인 실패 코드에 맞는 메시지를 노출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.signInWithEmailAndPasswordMock.mockRejectedValue(new FirebaseError('auth/invalid-email', 'invalid'))

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    await act(async () => {
      result.current.setAuthMode('login')
      result.current.setEmail('bad-email')
      result.current.setPassword('secret123')
    })

    await act(async () => {
      await result.current.handleEmailAuth()
    })

    expect(mocks.showToastMock).toHaveBeenCalledWith('이메일 형식이 올바르지 않습니다.')
  })

  it('회원가입 실패 코드(auth/email-already-in-use)에 맞는 메시지를 노출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.createUserWithEmailAndPasswordMock.mockRejectedValue(new FirebaseError('auth/email-already-in-use', 'exists'))

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    await act(async () => {
      result.current.setAuthMode('signup')
      result.current.setEmail('existing@user.com')
      result.current.setPassword('secret123')
    })

    await act(async () => {
      await result.current.handleEmailAuth()
    })

    expect(mocks.showToastMock).toHaveBeenCalledWith('이미 사용 중인 이메일입니다.')
  })

  it('회원가입 실패 코드(auth/weak-password)에 맞는 메시지를 노출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.createUserWithEmailAndPasswordMock.mockRejectedValue(new FirebaseError('auth/weak-password', 'weak'))

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    await act(async () => {
      result.current.setAuthMode('signup')
      result.current.setEmail('new@user.com')
      result.current.setPassword('secret123')
    })

    await act(async () => {
      await result.current.handleEmailAuth()
    })

    expect(mocks.showToastMock).toHaveBeenCalledWith('비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.')
  })

  it('구글 로그인 도메인 오류 코드에 맞는 메시지를 노출한다', async () => {
    const hydrateData = vi.fn().mockResolvedValue(undefined)
    mocks.signInWithPopupMock.mockRejectedValue(new FirebaseError('auth/unauthorized-domain', 'no domain'))

    const { result } = renderHook(() => useAuthSync({ hydrateData }))

    await waitFor(() => {
      expect(result.current.authReady).toBe(true)
    })

    await act(async () => {
      await result.current.handleGoogleLogin()
    })

    expect(mocks.showToastMock).toHaveBeenCalledWith('허용되지 않은 도메인입니다. Firebase Auth의 Authorized domains 설정을 확인해주세요.')
  })
})
