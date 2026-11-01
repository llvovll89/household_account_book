import { useState } from 'react'
import { X } from 'lucide-react'
import { useModalClose } from '../hooks/useModalClose'
import { clearUsageMeasurement, getUsageSummary, isUsageMeasurementEnabled, setUsageMeasurementEnabled } from '../lib/usageFlow'
import { showToast } from '../lib/toast'

const stageNames: Record<string, string> = { form: '입력', upload: '파일 선택', mapping: '컬럼 확인', preview: '미리보기', persist: '저장' }

export default function UsageInsightsModal({ onClose }: { onClose: () => void }) {
  const { modalRef, handleClose, closing } = useModalClose(onClose)
  const [days, setDays] = useState(7)
  const [enabled, setEnabled] = useState(isUsageMeasurementEnabled)
  const [, refresh] = useState(0)
  const summary = getUsageSummary(days)
  const exportSummary = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' }))
    const revoke = URL.revokeObjectURL.bind(URL)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'usage-summary.json'
    anchor.click()
    setTimeout(() => revoke(url), 1000)
  }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="usage-insights-title" onClick={event => event.target === event.currentTarget && handleClose()}>
      <div ref={modalRef} className="usage-insights modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        <div className="home-section-heading"><h2 id="usage-insights-title">사용 패턴</h2><button type="button" aria-label="사용 패턴 닫기" onClick={handleClose}><X size={20} /></button></div>
        <p className="home-description">입력과 가져오기를 얼마나 쉽게 마쳤는지 살펴보세요. 최근 30일의 단계·완료 여부·소요시간만 이 기기에 보관해요. 금액·적요·파일명은 측정하지 않아요. 이 사용 패턴은 외부로 전송하지 않아요.</p>
        <div className="usage-controls"><label><input type="checkbox" checked={enabled} onChange={event => {
          if (setUsageMeasurementEnabled(event.target.checked)) setEnabled(event.target.checked)
          else showToast('측정 설정을 저장하지 못했어요.', 3000, 'error')
        }} /> 사용 흐름 측정</label><label>기간 <select aria-label="사용 패턴 기간" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>최근 7일</option><option value={28}>최근 28일</option></select></label></div>
        <p className="home-description">최근 {days}일 안에 시작한 흐름 기준 · 기록을 완료한 날 {summary.recordedDays}일</p>
        {(['entry', 'import'] as const).map(flow => {
          const stats = summary[flow]
          return <section key={flow} aria-label={flow === 'entry' ? '입력 사용 패턴' : '가져오기 사용 패턴'}>
            <h3>{flow === 'entry' ? '내역 입력' : '파일 가져오기'}</h3>
            {stats.started === 0 ? <p className="home-description">아직 측정한 흐름이 없어요. {enabled ? '다음 사용부터 여기에 쌓여요.' : '측정을 켜면 다음 사용부터 쌓여요.'}</p> : <>
              <dl className="usage-stats"><div><dt>완료율</dt><dd>{stats.completionRate}%</dd></div><div><dt>시작 / 완료</dt><dd>{stats.started} / {stats.completed}회</dd></div><div><dt>완료 소요시간 중앙값</dt><dd>{stats.medianMs === null ? '—' : stats.medianMs < 1000 ? '1초 미만' : `${Math.round(stats.medianMs / 1000)}초`}</dd></div><div><dt>완료 전 닫음</dt><dd>{stats.closed}회</dd></div><div><dt>미완료·저장 대기</dt><dd>{stats.unfinished}회</dd></div><div><dt>오류가 있었던 흐름</dt><dd>{stats.withErrors}회</dd></div></dl>
              {stats.closed > 0 && <p className="home-description">닫은 단계: {Object.entries(stats.closedAt).filter(([, count]) => count > 0).map(([stage, count]) => `${stageNames[stage]} ${count}회`).join(' · ')}</p>}
            </>}
          </section>
        })}
        <p className="home-description">저장 성공 후에만 완료로 집계해요. 오류가 난 뒤 재시도해 완료한 흐름은 두 항목에 모두 포함될 수 있어요. 다른 기기나 전체 사용자의 재방문율을 뜻하지 않아요. 최대 600개 이벤트를 보관하며 오래된 흐름은 집계에서 빠질 수 있어요.</p>
        <div className="usage-actions"><button type="button" onClick={exportSummary}>요약 내보내기</button><button type="button" onClick={() => {
          if (clearUsageMeasurement()) { refresh(value => value + 1); showToast('사용 패턴 기록을 지웠어요.') }
          else showToast('사용 패턴 기록을 지우지 못했어요.', 3000, 'error')
        }}>측정 기록 지우기</button></div>
      </div>
    </div>
  )
}
