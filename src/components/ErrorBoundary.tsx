import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#181818] flex flex-col items-center justify-center px-6 text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-lg font-bold text-white mb-2">앱에 오류가 발생했어요</p>
          <p className="text-sm text-[#4E5968] mb-6">
            {this.state.error?.message ?? '알 수 없는 오류'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-2xl bg-[#3D8EF8] text-white font-bold text-sm"
          >
            앱 다시 시작
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
