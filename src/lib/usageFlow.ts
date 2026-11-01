import { generateId, toLocalDateStr } from './format'

export type UsageFlow = 'entry' | 'import'
export type UsageStage = 'form' | 'upload' | 'mapping' | 'preview' | 'persist'
type UsageAction = 'start' | 'step' | 'submit' | 'complete' | 'error' | 'abandon'
export interface UsageEvent { flowId: string; flow: UsageFlow; action: UsageAction; stage: UsageStage; at: number }
const KEY = 'hb_usage_flow_v1'
const ENABLED_KEY = 'hb_usage_flow_enabled'
const STAGES: UsageStage[] = ['form', 'upload', 'mapping', 'preview', 'persist']
const ACTIONS: UsageAction[] = ['start', 'step', 'submit', 'complete', 'error', 'abandon']
const MAX_AGE = 30 * 86400000

export function isUsageMeasurementEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== 'false' } catch { return false }
}
export function setUsageMeasurementEnabled(enabled: boolean): boolean {
  try { localStorage.setItem(ENABLED_KEY, String(enabled)); return true } catch { return false }
}
export function clearUsageMeasurement(): boolean {
  try { localStorage.removeItem(KEY); return true } catch { return false }
}

/** Read only the explicitly allowed fields; transaction data never enters this store. */
export function readUsageEvents(now = Date.now()): UsageEvent[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(data)) return []
    const events = data.filter((event): event is UsageEvent => !!event && typeof event === 'object'
      && typeof event.flowId === 'string' && event.flowId.length <= 100
      && (event.flow === 'entry' || event.flow === 'import') && ACTIONS.includes(event.action)
      && STAGES.includes(event.stage) && Number.isFinite(event.at) && event.at <= now && event.at >= now - MAX_AGE)
      .slice(-600).map(({ flowId, flow, action, stage, at }) => ({ flowId, flow, action, stage, at }))
    if (JSON.stringify(events) !== JSON.stringify(data)) write(events)
    return events
  } catch { return [] }
}
function write(events: UsageEvent[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(events.slice(-600))); return true } catch { return false }
}

export function beginUsageFlow(flow: UsageFlow): string | null {
  if (!isUsageMeasurementEnabled()) return null
  const flowId = generateId()
  const event: UsageEvent = { flowId, flow, action: 'start', stage: flow === 'entry' ? 'form' : 'upload', at: Date.now() }
  return write([...readUsageEvents(), event]) ? flowId : null
}
export function updateUsageFlow(flowId: string | null | undefined, action: Exclude<UsageAction, 'start'>, stage?: UsageStage): void {
  if (!flowId || !isUsageMeasurementEnabled() || !ACTIONS.includes(action)) return
  const events = readUsageEvents()
  const own = events.filter(event => event.flowId === flowId)
  const start = own.find(event => event.action === 'start')
  if (!start || own.some(event => event.action === 'complete' || event.action === 'abandon')) return
  const nextStage = stage ?? own.at(-1)!.stage
  if (!STAGES.includes(nextStage)) return
  if (action === 'step' && own.at(-1)?.stage === nextStage) return
  write([...events, { flowId, flow: start.flow, action, stage: nextStage, at: Date.now() }])
}

export function getUsageSummary(days = 7, now = Date.now()) {
  const cutoff = now - days * 86400000
  const events = readUsageEvents(now)
  const starts = events.filter(event => event.action === 'start' && event.at >= cutoff)
  const summarize = (flow: UsageFlow) => {
    const cohorts = starts.filter(event => event.flow === flow).map(start => ({ start, events: events.filter(event => event.flowId === start.flowId) }))
    const completed = cohorts.filter(cohort => cohort.events.some(event => event.action === 'complete'))
    const closed = cohorts.filter(cohort => cohort.events.some(event => event.action === 'abandon'))
    const durations = completed.map(cohort => Math.max(0, cohort.events.find(event => event.action === 'complete')!.at - cohort.start.at)).sort((a, b) => a - b)
    const middle = Math.floor(durations.length / 2)
    const medianMs = durations.length ? durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2 : null
    return {
      started: cohorts.length, completed: completed.length, closed: closed.length,
      unfinished: cohorts.length - completed.length - closed.length,
      withErrors: cohorts.filter(cohort => cohort.events.some(event => event.action === 'error')).length,
      completionRate: cohorts.length ? Math.round(completed.length / cohorts.length * 100) : null,
      medianMs,
      closedAt: Object.fromEntries(STAGES.map(stage => [stage, closed.filter(cohort => cohort.events.some(event => event.action === 'abandon' && event.stage === stage)).length])),
    }
  }
  const included = new Set(starts.map(event => event.flowId))
  const recordedDays = new Set(events.filter(event => included.has(event.flowId) && event.action === 'complete').map(event => toLocalDateStr(new Date(event.at)))).size
  return { days, recordedDays, entry: summarize('entry'), import: summarize('import') }
}
