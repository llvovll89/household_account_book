// 다크 테마 차트 공용 설정

export const CHART_COLORS = {
  income:       'var(--accent)',
  incomeLight:  'rgba(61,142,248,0.15)',
  expense:      'var(--expense)',
  expenseLight: 'rgba(242,82,96,0.15)',
  green:        'var(--income)',
  yellow:       'var(--category-gold)',
  purple:       'var(--category-violet)',
  teal:         'var(--category-teal)',
  bg:           'var(--page)',
  cardBg:       'var(--surface)',
  surface:      'var(--raised)',
  border:       'var(--line)',
  textPrimary:  'var(--text)',
  textSecondary:'var(--muted)',
  textMuted:    'var(--muted)',
}

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 12px',
}

export const TOOLTIP_CURSOR_STYLE = { fill: 'rgba(255,255,255,0.04)' }
export const TOOLTIP_LABEL_STYLE = { color: 'var(--muted)', fontSize: 11 }

export const GRID_PROPS = {
  strokeDasharray: '3 3' as const,
  stroke: 'var(--line)',
  vertical: false,
}

export const AXIS_TICK_STYLE = {
  fill: 'var(--muted)',
  fontSize: 10,
}

/** 만/억 단위 포맷터 (YAxis tickFormatter 등에 사용) */
export function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return n.toLocaleString()
}
