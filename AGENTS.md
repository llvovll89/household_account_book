# Repository workflow

- Work on a separate feature branch for each independently reviewable improvement.
- Follow the sequence: branch from current main, implement, validate, commit logical units, push, open a PR, wait for checks, then merge.
- Respect branch protection and required checks. Never bypass them.
- Synchronize local main after each merge before starting the next branch.
- Preserve existing uncommitted user changes; do not include them in unrelated commits.
- For the retention improvements, complete these in order on separate branches: mobile quick entry, home information hierarchy, post-save feedback, weekly summary and returning-user flow.
- Keep the Korean UI and existing brand, theme tokens, and component conventions.
