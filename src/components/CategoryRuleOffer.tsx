import type { AutoCategoryRule, TransactionType } from '../types'
import { applyAutoCategory, getCorrectionKeyword } from '../lib/autoCategoryRules'

interface Props {
  description: string
  category: string
  type: TransactionType
  rules: AutoCategoryRule[]
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function CategoryRuleOffer({ description, category, type, rules, checked, onChange }: Props) {
  const keyword = getCorrectionKeyword(description)
  if (!keyword || applyAutoCategory(description, type, rules) === category) return null
  const replaces = rules.some(r => r.type === type && r.keyword.toLowerCase() === keyword.toLowerCase())
  return (
    <div className="category-rule-offer">
      <label><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /> 다음에도 같은 적요에 {category} 적용하기</label>
      <p>“{keyword}”이 포함된 {type === 'expense' ? '지출' : '수입'}에 적용해요. {replaces ? '같은 키워드의 기존 규칙을 변경해요.' : '이 규칙을 먼저 적용해요.'} 저장할 때 반영하며 과거 내역은 바꾸지 않아요.</p>
    </div>
  )
}
