import type { Transaction } from '../types'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 설명 속 #태그 하나와 정확히 일치 (태그는 공백·# 앞에서 끝난다 — TransactionModal의 parseHashtags와 같은 규칙)
function hashtagPattern(tag: string): RegExp {
  return new RegExp(`#${escapeRegExp(tag)}(?=[\\s#]|$)`, 'g')
}

export function removeHashtag(description: string, tag: string): string {
  return description.replace(hashtagPattern(tag), ' ').replace(/\s+/g, ' ').trim()
}

/** 태그 이름을 바꾸면서 설명의 #태그도 함께 바꾼다. 수정 화면이 설명에서 태그를 다시 만들기 때문이다. */
export function renameTransactionTag(t: Transaction, oldName: string, newName: string): Transaction {
  if (!t.tags?.includes(oldName)) return t
  const description = t.tags.includes(newName)
    ? removeHashtag(t.description, oldName)
    : t.description.replace(hashtagPattern(oldName), `#${newName}`)
  return { ...t, description, tags: [...new Set(t.tags.map((tag) => (tag === oldName ? newName : tag)))] }
}

export function deleteTransactionTag(t: Transaction, name: string): Transaction {
  if (!t.tags?.includes(name)) return t
  return { ...t, description: removeHashtag(t.description, name), tags: t.tags.filter((tag) => tag !== name) }
}
