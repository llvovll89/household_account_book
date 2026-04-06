import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { ko } from 'date-fns/locale'

interface FancyDatePickerProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  size?: 'sm' | 'md'
}

function parseYmd(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const PickerTrigger = forwardRef<HTMLButtonElement, {
  value?: string
  onClick?: () => void
  size: 'sm' | 'md'
}>(({ value, onClick, size }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={`fancy-date-trigger w-full rounded-xl border border-white/8 bg-[#131826] text-left text-[#D3D9E3] transition-colors hover:border-[#3D8EF8]/40 hover:bg-[#161D2E] ${
      size === 'sm' ? 'px-3 py-2 text-[13px] font-semibold' : 'px-3.5 py-2.5 text-sm font-bold'
    }`}
  >
    <span className="flex items-center justify-between gap-2">
      <span>{value}</span>
      <CalendarDays size={15} className="text-[#6A7688]" />
    </span>
  </button>
))

PickerTrigger.displayName = 'PickerTrigger'

export default function FancyDatePicker({ value, onChange, min, max, size = 'md' }: FancyDatePickerProps) {
  const selected = parseYmd(value)
  const minDate = min ? (parseYmd(min) || undefined) : undefined
  const maxDate = max ? (parseYmd(max) || undefined) : undefined

  return (
    <DatePicker
      selected={selected}
      onChange={(next: Date | null) => {
        if (!next) return
        onChange(toYmd(next))
      }}
      minDate={minDate}
      maxDate={maxDate}
      locale={ko}
      dateFormat="yyyy.MM.dd (eee)"
      calendarStartDay={0}
      showPopperArrow={false}
      popperPlacement="bottom-start"
      popperClassName="fancy-date-popper"
      calendarClassName="fancy-date-calendar"
      customInput={<PickerTrigger size={size} />}
      renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/8">
          <button
            type="button"
            onClick={decreaseMonth}
            className="w-7 h-7 rounded-lg bg-white/6 text-[#9AA3B2] hover:bg-white/12 hover:text-white flex items-center justify-center"
            aria-label="이전 달"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-bold text-white">
            {date.getFullYear()}년 {date.getMonth() + 1}월
          </span>
          <button
            type="button"
            onClick={increaseMonth}
            className="w-7 h-7 rounded-lg bg-white/6 text-[#9AA3B2] hover:bg-white/12 hover:text-white flex items-center justify-center"
            aria-label="다음 달"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    />
  )
}
