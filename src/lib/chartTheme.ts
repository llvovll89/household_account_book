// 다크 테마 차트 공용 설정

export const CHART_COLORS = {
  income:       '#3D8EF8',
  incomeLight:  'rgba(61,142,248,0.15)',
  expense:      '#F25260',
  expenseLight: 'rgba(242,82,96,0.15)',
  green:        '#2ACF6A',
  yellow:       '#F5BE3A',
  purple:       '#9B7EFF',
  teal:         '#1FD9B4',
  bg:           '#0D0F14',
  cardBg:       '#1E2236',
  surface:      '#252A3F',
  border:       'rgba(255,255,255,0.06)',
  textPrimary:  '#F1F3F6',
  textSecondary:'#8B95A1',
  textMuted:    '#4E5968',
}

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: '#252A3F',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  color: '#F1F3F6',
  fontSize: 12,
  padding: '8px 12px',
}

export const TOOLTIP_CURSOR_STYLE = { fill: 'rgba(255,255,255,0.04)' }
export const TOOLTIP_LABEL_STYLE = { color: '#8B95A1', fontSize: 11 }

export const GRID_PROPS = {
  strokeDasharray: '3 3' as const,
  stroke: 'rgba(255,255,255,0.05)',
  vertical: false,
}

export const AXIS_TICK_STYLE = {
  fill: '#4E5968',
  fontSize: 10,
}

/** 만/억 단위 포맷터 (YAxis tickFormatter 등에 사용) */
export function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return n.toLocaleString()
}
