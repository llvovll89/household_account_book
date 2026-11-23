import { lazy, Suspense, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { FancyDatePickerProps } from './CalendarDatePicker'

const CalendarDatePicker = lazy(() => import('./CalendarDatePicker'))

export default function FancyDatePicker(props: FancyDatePickerProps) {
  const [opened, setOpened] = useState(false)
  const date = new Date(`${props.value}T00:00:00`)
  const label = Number.isNaN(date.getTime()) ? '날짜 선택' : `${props.value.replaceAll('-', '.')} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`
  const trigger = <button type="button" onClick={() => setOpened(true)} aria-label={`날짜 선택: ${label}`}
    className={`fancy-date-trigger w-full rounded-xl border border-white/8 bg-raised text-left text-fg transition-colors hover:border-tone-blue/40 hover:bg-tone-hover ${props.size === 'sm' ? 'px-3 py-2 text-[13px] font-semibold' : 'px-3.5 py-2.5 text-sm font-bold'}`}>
    <span className="flex items-center justify-between gap-2"><span>{label}</span><CalendarDays size={15} className="text-muted" /></span>
  </button>
  return opened ? <Suspense fallback={<div aria-busy="true">{trigger}<span role="status" className="text-xs text-muted">달력을 불러오는 중...</span></div>}>
    <CalendarDatePicker {...props} initiallyOpen />
  </Suspense> : trigger
}
