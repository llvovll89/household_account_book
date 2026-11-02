import { useEffect, useState } from 'react'
import { Download, Upload, X } from 'lucide-react'
import { useModalClose } from '../hooks/useModalClose'
import { createBackup, MAX_BACKUP_BYTES, parseBackup } from '../lib/backup'
import type { BackupFile } from '../lib/backup'
import { loadBackupState, restoreAllData } from '../lib/storage'
import type { AppDataSnapshot, BackupState } from '../lib/storage'

interface Props {
  onClose: () => void
  onRestored: (data: AppDataSnapshot, cacheSaved: boolean) => void
  canRestore: () => boolean
  accountLabel?: string
}
const collections = [['transactions', '거래 내역'], ['memos', '메모'], ['budgets', '예산'], ['recurring', '정기 내역'], ['subscriptions', '구독'], ['goals', '저축 목표']] as const
const settingLists = [['userPaymentMethods', '결제수단'], ['customExpenseCategories', '사용자 지출 카테고리'], ['customIncomeCategories', '사용자 수입 카테고리'], ['transactionTemplates', '입력 템플릿'], ['autoCategoryRules', '자동 분류 규칙'], ['hiddenWidgets', '숨긴 위젯']] as const
const dayLabel = (day: number | 'last' | null) => day === null ? '미설정' : day === 'last' ? '말일' : `${day}일`
const sensitivity = (value?: string) => value === 'low' ? '낮음' : value === 'high' ? '높음' : '보통'
function message(error: unknown) {
  return error instanceof Error && /[가-힣]/.test(error.message) ? error.message : '데이터를 처리하지 못했어요. 연결 상태와 저장 공간을 확인한 뒤 다시 시도해주세요.'
}
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요. 다른 백업 파일을 선택해주세요.'))
    reader.readAsText(file)
  })
}

export default function BackupModal({ onClose, onRestored, canRestore, accountLabel }: Props) {
  const [current, setCurrent] = useState<BackupState | null>(null)
  const [incoming, setIncoming] = useState<BackupFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const { closing, handleClose, modalRef } = useModalClose(onClose, { onBeforeClose: () => !busy })
  const targetLabel = current?.token.mode === 'firebase' && accountLabel ? `${current.target} · ${accountLabel}` : current?.target ?? '확인 필요'
  useEffect(() => {
    let cancelled = false
    void loadBackupState().then(state => { if (!cancelled) setCurrent(state) }).catch(e => { if (!cancelled) setError(message(e)) }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [])

  async function download() {
    setBusy(true); setError(''); setIncoming(null); setAccepted(false)
    try {
      const state = await loadBackupState()
      const content = createBackup(state.data)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url; a.download = `잔고플랜-전체백업-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setCurrent(state)
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function preview(file?: File) {
    if (!file) return
    setBusy(true); setError(''); setIncoming(null); setAccepted(false); setFileName(file.name)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 10MB 이하여야 해요.')
      const parsed = parseBackup(await readText(file))
      const state = await loadBackupState()
      setCurrent(state); setIncoming(parsed)
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function restore() {
    if (!incoming || !current || !accepted || busy) return
    if (!canRestore()) { setError('저장 또는 동기화를 마친 뒤 복원해주세요.'); return }
    setBusy(true); setError('')
    try {
      const result = await restoreAllData(incoming.data, current.token)
      onRestored(result.data, result.cacheSaved)
    } catch (e) { setError(message(e)); setAccepted(false) } finally { setBusy(false) }
  }

  return <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="backup-title" onClick={e => e.target === e.currentTarget && handleClose()}>
    <div ref={modalRef} className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[90dvh] flex flex-col border-t border-white/6 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
      <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-white/10 rounded-full" /></div>
      <div className="flex items-center justify-between px-6 py-4">
        <div><h2 id="backup-title" className="text-[18px] font-bold text-white">전체 백업·복원</h2><p className="text-xs text-[#8B95A1] mt-1">저장된 가계부와 설정을 JSON 파일로 옮겨요.</p></div>
        <button type="button" aria-label="백업·복원 닫기" disabled={busy} onClick={handleClose} className="w-11 h-11 flex items-center justify-center shrink-0"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto px-6 pb-6 space-y-5">
        <p className="text-sm text-[#8B95A1] break-all">대상: <strong className="text-white">{busy && !current ? '확인 중' : targetLabel}</strong></p>
        <button type="button" disabled={busy} onClick={() => void download()} className="home-primary-action disabled:opacity-50"><Download size={17} /> 전체 백업 다운로드</button>
        <p className="text-xs text-[#8B95A1] leading-relaxed">거래·메모·예산·정기 내역·구독·저축 목표와 결제수단, 카테고리, 템플릿, 분류 규칙 등 설정이 포함돼요. 영수증은 링크만 보관하며 이미지 파일은 포함하지 않아요. 로그인 정보와 기기별 테마·사용 통계는 제외돼요.</p>
        <div className="border-t border-white/10 pt-4 space-y-3">
          <label htmlFor="backup-file" className="flex gap-2 items-center text-sm font-bold text-white"><Upload size={17} /> 백업 파일로 복원</label>
          <input id="backup-file" type="file" accept=".json,application/json" disabled={busy} className="block w-full text-sm text-[#8B95A1] file:mr-3 file:rounded-xl file:border-0 file:bg-[#2C2C2E] file:px-4 file:py-3 file:text-[#D3D9E3]" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void preview(file) }} />
          <p className="text-xs text-[#8B95A1]">잔고플랜 전체 백업 JSON · 최대 10MB</p>
        </div>
        {busy && <p role="status" className="text-sm text-[#8B95A1]">데이터를 처리하는 중이에요. 잠시 기다려주세요.</p>}
        {error && <p role="alert" className="text-sm text-[#F25260] leading-relaxed">{error}</p>}
        {incoming && current && <div className="space-y-4">
          <div className="text-xs text-[#8B95A1] break-all">{fileName}<br />백업 시각: {new Date(incoming.createdAt).toLocaleString('ko-KR')}</div>
          <table className="w-full text-sm text-left">
            <caption className="text-left font-bold text-white pb-3">현재 저장된 데이터와 백업 데이터 비교</caption>
            <thead className="text-xs text-[#8B95A1]"><tr><th scope="col" className="py-2">항목</th><th scope="col" className="text-right">현재</th><th scope="col" className="text-right">복원 후</th></tr></thead>
            <tbody>{[...collections.map(([key, label]) => [label, `${current.data[key].length}건`, `${incoming.data[key].length}건`]), ...settingLists.map(([key, label]) => [label, `${current.data.settings[key].length}개`, `${incoming.data.settings[key].length}개`]), ['급여일', dayLabel(current.data.settings.payday), dayLabel(incoming.data.settings.payday)], ['카드 결제일', dayLabel(current.data.settings.cardBillingDay), dayLabel(incoming.data.settings.cardBillingDay)], ['스와이프 민감도', sensitivity(current.data.settings.swipeSensitivity), sensitivity(incoming.data.settings.swipeSensitivity)]].map(([label, before, after]) => <tr key={label} className="border-t border-white/6"><th scope="row" className="py-2 font-medium text-[#8B95A1]">{label}</th><td className="text-right text-[#8B95A1]">{before}</td><td className="text-right font-bold text-white">{after}</td></tr>)}</tbody>
          </table>
          <p className="text-sm text-[#F5BE3A] leading-relaxed">{targetLabel}의 기존 데이터와 설정을 위 내용으로 모두 교체해요. 현재 내용을 남기려면 먼저 전체 백업을 다운로드해주세요.</p>
          <label className="flex items-start gap-3 text-sm text-[#D3D9E3] leading-relaxed"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" /> 대상과 변경 내용을 확인했으며 기존 데이터 전체 교체에 동의해요.</label>
          {!canRestore() && <p className="text-xs text-[#F25260]">진행 중이거나 실패한 저장·동기화를 먼저 마쳐주세요.</p>}
          <button type="button" onClick={() => void restore()} disabled={busy || !accepted || !canRestore()} className="home-primary-action disabled:opacity-40">확인한 백업으로 전체 복원</button>
        </div>}
      </div>
    </div>
  </div>
}
