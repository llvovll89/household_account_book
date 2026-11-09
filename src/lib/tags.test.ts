import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { removeHashtag, renameTransactionTag, deleteTransactionTag } from './tags'

const tx = (description: string, tags: string[]): Transaction => ({ id: 't', type: 'expense', amount: 1000, category: '식비', description, tags, date: '2026-11-01', createdAt: 1 })

describe('removeHashtag', () => {
  it('removes tags containing regex special characters without throwing', () => {
    expect(removeHashtag('개발 책 #c++ #(주)회식', 'c++')).toBe('개발 책 #(주)회식')
    expect(removeHashtag('개발 책 #c++ #(주)회식', '(주)회식')).toBe('개발 책 #c++')
  })

  it('does not treat a dot as a wildcard', () => {
    expect(removeHashtag('#a.b #aXb', 'a.b')).toBe('#aXb')
  })

  it('removes a tag directly followed by another tag', () => {
    expect(removeHashtag('점심 #외식#회사', '외식')).toBe('점심 #회사')
  })
})

describe('tag rename and delete keep description and tags in sync', () => {
  it('renames the hashtag in the description so the next edit does not restore it', () => {
    expect(renameTransactionTag(tx('점심 #외식', ['외식']), '외식', '식사')).toMatchObject({ description: '점심 #식사', tags: ['식사'] })
  })

  it('merging into an existing tag does not duplicate it', () => {
    expect(renameTransactionTag(tx('점심 #식비 #외식', ['식비', '외식']), '외식', '식비')).toMatchObject({ description: '점심 #식비', tags: ['식비'] })
  })

  it('deleting removes the hashtag from the description too', () => {
    expect(deleteTransactionTag(tx('점심 #외식 맛집', ['외식']), '외식')).toMatchObject({ description: '점심 맛집', tags: [] })
  })

  it('leaves unrelated transactions untouched', () => {
    const other = tx('저녁 #가족', ['가족'])
    expect(renameTransactionTag(other, '외식', '식사')).toBe(other)
    expect(deleteTransactionTag(other, '외식')).toBe(other)
  })
})
