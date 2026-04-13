import { X, LayoutDashboard, List, BarChart2, StickyNote, Plus, FileDown, TrendingUp } from 'lucide-react'

interface Props {
  onClose: () => void
}

const sections = [
  {
    icon: LayoutDashboard,
    color: '#3D8EF8',
    title: '홈',
    items: [
      '이번 달 수입·지출과 이월 잔액을 한눈에 확인해요.',
      '카테고리별 예산을 설정하고 사용률을 추적할 수 있어요.',
      '월세·구독료 같은 정기 지출을 등록하면 매달 자동으로 반영돼요.',
      '급여일을 설정하면 남은 일일 예산을 계산해줘요.',
    ],
  },
  {
    icon: Plus,
    color: '#2ACF6A',
    title: '내역 추가',
    items: [
      '우측 하단 + 버튼을 눌러 수입·지출을 기록해요.',
      '금액, 카테고리, 날짜, 설명을 입력할 수 있어요.',
      '등록한 내역은 수정/삭제 버튼으로 바로 편집할 수 있어요.',
    ],
  },
  {
    icon: List,
    color: '#A78BFA',
    title: '내역',
    items: [
      '이번 달 모든 거래 내역을 날짜순으로 보여줘요.',
      '카테고리 필터로 원하는 항목만 골라볼 수 있어요.',
      '각 항목의 수정/삭제 버튼으로 거래를 관리할 수 있어요.',
    ],
  },
  {
    icon: BarChart2,
    color: '#F5BE3A',
    title: '분석',
    items: [
      '카테고리별 지출 비율을 도넛 차트로 확인해요.',
      '월별 수입·지출 추이를 막대 그래프로 볼 수 있어요.',
      '지출이 많은 카테고리 TOP 순위를 보여줘요.',
    ],
  },
  {
    icon: StickyNote,
    color: '#F87171',
    title: '메모',
    items: [
      '예산 목표, 쇼핑 목록 등 자유롭게 메모를 남겨요.',
      '금액·카테고리·날짜를 함께 기록할 수 있어요.',
      'Pin 아이콘을 눌러 중요한 메모를 상단에 고정해요.',
    ],
  },
  {
    icon: TrendingUp,
    color: '#60A5FA',
    title: '주식',
    items: [
      '주식 탭은 로그인한 경우에만 표시돼요.',
      '매수/매도 거래를 기록하고 거래 내역을 관리할 수 있어요.',
      '주식 데이터는 로그인 계정의 Firebase에 저장돼요.',
    ],
  },
  {
    icon: FileDown,
    color: '#34D399',
    title: '가져오기',
    items: [
      '상단 가져오기 버튼으로 CSV 파일을 불러올 수 있어요.',
      '은행 앱에서 내보낸 거래 내역을 한 번에 등록해요.',
    ],
  },
  {
    icon: LayoutDashboard,
    color: '#22C55E',
    title: '로그인/동기화',
    items: [
      '비로그인 상태에서는 이 기기(local) 저장소를 사용해요.',
      '로그인하면 Firebase와 동기화되어 계정별로 데이터를 관리해요.',
      '로그인 시 로컬 데이터 병합 여부를 선택할 수 있어요.',
    ],
  },
]

export default function HelpModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[85vh] flex flex-col border-t border-white/6">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">사용 가이드</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">잔고플랜 앱 기능 안내</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center"
          >
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="overflow-y-auto flex-1 px-6 pb-8 space-y-3">
          {sections.map(({ icon: Icon, color, title, items }) => (
            <div key={title} className="bg-[#2C2C2E] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}1A` }}
                >
                  <Icon size={17} style={{ color }} />
                </div>
                <span className="text-[15px] font-bold text-white">{title}</span>
              </div>
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.25 w-1 h-1 rounded-full bg-[#4E5968] shrink-0" />
                    <span className="text-[13px] text-[#8B95A1] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* 팁 */}
          <div className="bg-[#3D8EF8]/10 border border-[#3D8EF8]/20 rounded-2xl p-4 flex gap-3">
            <TrendingUp size={17} className="text-[#3D8EF8] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#8B95A1] leading-relaxed">
              비로그인 데이터는 이 기기에 저장되고, 로그인 데이터는 Firebase 계정에 저장돼요. 앱을 홈 화면에 추가하면 오프라인에서도 사용할 수 있어요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
