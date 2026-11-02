import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const directory = resolve(process.argv[2] ?? 'dist2')
const manifest = JSON.parse(readFileSync(resolve(directory, '.vite/manifest.json'), 'utf8'))
const scenarios = {
  home: ['index.html', 'src/components/workspaces/LedgerWorkspace.tsx', 'src/components/Dashboard.tsx'],
  entry: ['index.html', 'src/components/workspaces/LedgerWorkspace.tsx', 'src/components/Dashboard.tsx', 'src/components/TransactionModal.tsx'],
}
for (const [scenario, roots] of Object.entries(scenarios)) {
  const files = new Set()
  function visit(key) {
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Missing manifest entry: ${key}`)
    if (files.has(chunk.file)) return
    files.add(chunk.file)
    for (const dependency of chunk.imports ?? []) visit(dependency)
  }
  for (const root of roots) {
    // Rollup may promote a dynamic entry to a shared named chunk.
    const name = root.split('/').at(-1).replace(/\.tsx$/, '')
    const key = manifest[root] ? root : Object.keys(manifest).find(k => manifest[k].name === name && manifest[k].isDynamicEntry)
    if (!key) throw new Error(`Missing scenario root: ${root}`)
    visit(key)
  }
  const chunks = [...files].filter(f => f.endsWith('.js')).map(file => ({ file, gzipBytes: gzipSync(readFileSync(resolve(directory, file))).length }))
  const gzipBytes = chunks.reduce((sum, c) => sum + c.gzipBytes, 0)
  console.log(JSON.stringify({ scenario, gzipBytes, chunks }, null, 2))
  if (process.argv.includes('--check')) {
    const forbidden = chunks.filter(c => /(?:vendor-charts|vendor-xlsx|vendor-pdf|MonthlyDashboard|CalendarDatePicker|Analytics)-/.test(c.file))
    if (forbidden.length || gzipBytes > (scenario === 'home' ? 250000 : 280000)) {
      throw new Error(`${scenario} exceeds its startup budget or loads a deferred feature eagerly`)
    }
  }
}
