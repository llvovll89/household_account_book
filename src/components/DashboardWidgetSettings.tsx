import { X } from 'lucide-react'
import { useModalClose } from '../hooks/useModalClose'
import type { DashboardWidgetId } from '../types'

interface WidgetDef {
  id: DashboardWidgetId
  label: string
  description: string
}

const WIDGETS: WidgetDef[] = [
  { id: 'subscription-alert', label: '구독 청구 예고', description: '이번 주 구독 서비스 청구 알림' },
  { id: 'recurring-pending', label: '정기 지출 미적용', description: '이달 미등록 정기 내역 안내' },
  { id: 'sparkline-summary', label: '6개월 추이', description: '수입/지출/잔액 스파크라인' },
  { id: 'today-spending', label: '오늘 지출', description: '오늘 지출 현황 및 최근 거래' },
  { id: 'health-score', label: '재정 건강도', description: '저축률·예산 준수 기반 점수' },
  { id: 'spending-pace', label: '소비 페이스', description: '시간 대비 지출 진행도' },
  { id: 'weekly-comparison', label: '주간 지출 비교', description: '이번 주 vs 지난 주 요일별 비교' },
  { id: 'timeofday-spending', label: '시간대별 지출', description: '아침/낮/저녁/밤 분포' },
  { id: 'top3-expenses', label: '이달 최대 지출 TOP3', description: '금액 기준 상위 3개 거래' },
  { id: 'payday-countdown', label: '월급날 카운트다운', description: '월급일까지 남은 일수 및 일일 가용액' },
  { id: 'net-worth', label: '순자산 현황', description: '누적 잔액 · 주식 · 저축 목표' },
  { id: 'goal-daily-needed', label: '목표 일일 저금액', description: '저축 목표 달성 필요 일일액' },
  { id: 'spending-spike', label: '소비 급증 감지', description: '전월 대비 30% 이상 급증한 카테고리 알림' },
]

interface Props {
  hiddenWidgets: DashboardWidgetId[]
  onSave: (hidden: DashboardWidgetId[]) => void
  onClose: () => void
}

export default function DashboardWidgetSettings({ hiddenWidgets, onSave, onClose }: Props) {
  const { closing, handleClose } = useModalClose(onClose)

  function toggle(id: DashboardWidgetId) {
    const next = hiddenWidgets.includes(id)
      ? hiddenWidgets.filter((w) => w !== id)
      : [...hiddenWidgets, id]
    onSave(next)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] px-5 pt-5 pb-8 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold text-white">홈 위젯 설정</h2>
            <p className="text-[12px] text-[#8B95A1] mt-0.5">표시할 위젯을 선택하세요</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E]">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        {/* 고정 위젯 안내 */}
        <div className="bg-[#2C2C2E] rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="text-[12px] text-[#8B95A1]">잔액 카드와 예산 관리는 항상 표시됩니다</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {WIDGETS.map((w) => {
            const enabled = !hiddenWidgets.includes(w.id)
            return (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                className="w-full flex items-center gap-4 bg-[#2C2C2E] rounded-xl px-4 py-3 text-left"
              >
                {/* 토글 */}
                <div className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${enabled ? 'bg-[#3D8EF8]' : 'bg-[#3A3A3C]'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-semibold ${enabled ? 'text-white' : 'text-[#4E5968]'}`}>{w.label}</p>
                  <p className="text-[11px] text-[#8B95A1] mt-0.5">{w.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
