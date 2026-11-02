# Startup loading budget

Run `npm run build:verify` to build and enforce the startup budget, or `npm run measure:startup` to inspect an existing `dist2` build. The report follows static manifest imports from the app entry, workspace, and active home; the entry scenario adds the transaction form. It sums each JavaScript file's gzip bytes once. CSS, fonts, service-worker downloads, network latency, and runtime rendering time are outside this metric.

On 2026-11-02, the production home graph fell from 408,404 to 217,971 gzip bytes (46.6%). The transaction-entry graph is 233,226 bytes. The before measurement followed the same static-import closure in the built JavaScript because the previous build did not emit a manifest. PWA precache fell from 1,817.38 to 1,152.88 KiB of uncompressed assets. These are build measurements, not a claim about real-phone LCP.

The home and entry checks reject charts, spreadsheet/PDF parsers, analytics, the full monthly dashboard, and the calendar in their eager dependency graphs. Limits are 250,000 bytes for home and 280,000 for entry. Intent-based tab/form prefetching remains; blanket idle and predicted-tab prefetching is removed. The monthly widgets and calendar mount only when requested.

Charts and calendar are excluded from installation precache. A bounded same-origin asset runtime cache makes them available offline after a successful online visit; opening them offline before their first download still needs connectivity.

Mobile production QA at 390 × 844 verified the date trigger, first calendar opening, date selection, saving a transaction, and opening monthly widgets. Browser resource timing showed no calendar, monthly-dashboard, or chart requests before those actions.

References: [Vite manifest](https://vite.dev/guide/backend-integration), [React lazy](https://react.dev/reference/react/lazy).
