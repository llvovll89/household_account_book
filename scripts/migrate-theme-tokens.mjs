// hex 색상 클래스(bg-[#1C1C1E] 등)를 테마 토큰 클래스로 치환한다.
// 사용: node scripts/migrate-theme-tokens.mjs <파일...> [--dry]
// - 기본 클래스(접두사·투명도 없음)이면서 interface.css가 이미 CSS 변수로 그리던 것 → 의미 토큰 (다크 화면 동일)
// - 그 외(hover:, /15 등 변형)는 기존 hex를 그대로 그리던 것 → 다크 값이 같은 톤 토큰 (다크 화면 동일)
// - 표에 없는 색은 건드리지 않고 보고만 한다
import { readFileSync, writeFileSync } from 'node:fs'

// [유틸리티 종류, HEX] → interface.css가 기본 클래스를 바꿔 그리던 의미 토큰
const SEMANTIC = {
  'text:F1F3F6': 'fg', 'text:E8EDF5': 'fg', 'text:C8D1DC': 'fg', 'text:D9DEEA': 'fg',
  'text:8B95A1': 'muted', 'text:9CA6B3': 'muted', 'text:4E5968': 'muted', 'text:B6C0CE': 'muted',
  'text:3D8EF8': 'accent', 'text:79B2FF': 'accent', 'text:80B8FF': 'accent',
  'text:A8EEC4': 'accent', 'text:92E6D9': 'accent', 'text:9CC7FF': 'accent', 'text:B8DCFF': 'accent',
  'text:2ACF6A': 'income', 'text:F25260': 'expense',
  'bg:111111': 'page', 'bg:1C1C1E': 'surface', 'bg:2C2C2E': 'raised', 'bg:3A3A3C': 'raised',
  'bg:0D0F14': 'raised', 'bg:151923': 'raised', 'bg:161D2C': 'raised',
}

// HEX → 다크 값이 같은 톤 토큰 (변형 클래스용, 기본 클래스라도 위 표에 없으면 사용)
const TONE = {
  '3D8EF8': 'tone-blue', 'F25260': 'tone-red', '2ACF6A': 'tone-green', 'F5BE3A': 'tone-amber',
  '6AD3C0': 'tone-teal', '4E5968': 'tone-slate', '8B95A1': 'tone-gray', '3A3A3C': 'tone-hover',
  'F5F7FA': 'fg-strong', 'FF8D98': 'tone-red-soft', 'FF9AA4': 'tone-red-pale',
  'D8FFE8': 'tone-green-pale', 'D7FFF7': 'tone-teal-pale', 'DCEBFF': 'tone-blue-pale',
}

// 같은 HEX라도 역할이 다른 경우 (유틸리티 종류로 구분)
const ROLE_TONE = { 'to:2C2C2E': 'tone-chip', 'from:2C2C2E': 'tone-chip', 'text:2C2C2E': 'tone-faint', 'text:F5BE3A': 'warning' }

// 다른 CSS 규칙(글자색·hover)과 묶여 있어 별도 PR에서 다룰 액션 버튼 색
const SKIP = new Set(['bg:3D8EF8', 'bg:3182F6', 'bg:244268', 'bg:5AA0FF', 'bg:2272EB'])

const CLASS = /((?:[a-z-]+:)*)(bg|text|border|from|to|via|fill|stroke|ring|outline|decoration|placeholder|divide|shadow)-\[#([0-9A-Fa-f]{6})\](\/\d+)?(?![\w-])/g

// interface.css 선택자는 대소문자를 구분하므로, 실제로 변수로 바뀌어 그려지는지는 정확한 클래스명으로 판정한다
// 라이트 테마 안에서만 바꾸는 규칙은 다크에서 원래 hex로 그려지므로 제외한다
const themeCss = readFileSync(new URL('../src/interface.css', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((line) => !line.includes(':root[data-theme="light"]'))
  .join('\n')
const isRemapped = (util, rawHex) => themeCss.includes(`[class~="${util}-[#${rawHex}]"]`)

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const dry = process.argv.includes('--dry')
const left = {}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  let changed = 0
  const out = src.replace(CLASS, (match, variants, util, rawHex, opacity = '') => {
    const hex = rawHex.toUpperCase()
    const key = `${util}:${hex}`
    const isBase = !variants && !opacity
    if (isBase && SKIP.has(key)) { left[match] = (left[match] ?? 0) + 1; return match }
    if (variants.includes('hover:') && SKIP.has(`bg:${hex}`) && util === 'bg' && !opacity) { left[match] = (left[match] ?? 0) + 1; return match }
    const remapped = isBase && isRemapped(util, rawHex)
    // 변수로 그려지던 기본 클래스는 의미 토큰만 허용 (톤 토큰으로 바꾸면 다크 색이 달라진다)
    const token = remapped ? SEMANTIC[key] : (ROLE_TONE[key] || TONE[hex])
    if (!token) { left[match] = (left[match] ?? 0) + 1; return match }
    changed += 1
    return `${variants}${util}-${token}${opacity}`
  })
  if (!dry && out !== src) writeFileSync(file, out)
  console.log(`${file}: ${changed}개 치환`)
}

const rest = Object.entries(left).sort((a, b) => b[1] - a[1])
if (rest.length) {
  console.log('치환하지 않은 hex 클래스:')
  for (const [cls, n] of rest) console.log(`  ${n}\t${cls}`)
}
