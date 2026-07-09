import { describe, expect, it } from 'vitest'
import { parseYmdLocal, toLocalDateStr } from './format'

describe('parseYmdLocal', () => {
  it('YYYY-MM-DD 문자열을 해당 로컬 날짜로 파싱한다', () => {
    const d = parseYmdLocal('2026-06-04')

    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(4)
  })

  it('요일 계산이 UTC 파싱과 무관하게 안정적이다', () => {
    const d = parseYmdLocal('2026-01-01')

    expect(d.getDay()).toBe(4)
  })
})

describe('toLocalDateStr', () => {
  it('Date 객체를 로컬 YYYY-MM-DD 문자열로 변환한다', () => {
    const d = new Date(2026, 6, 9, 23, 59, 59)

    expect(toLocalDateStr(d)).toBe('2026-07-09')
  })
})