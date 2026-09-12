# Vendor provenance — @dimina/bundler

| Field | Value |
| --- | --- |
| Source tag | `fe-tools-copy-source` (`242b8622`) |
| Source path | `fe/packages/compiler/**` |
| Target path | `fe/tools/bundler/**` |
| Package rename | `@dimina/compiler` → `@dimina/bundler` |
| CLI bin | `dmcc` → `dimina-cli` |
| Copied | 2026-09-10 |
| Action | `fe-tools-bootstrap-copy` |

Sync: see `docs/actions/fe-tools-sidecar/sync-rhythm.md` (TS-4). Prefer merging didi into work-branch `packages/`, then selectively port into this tree. Do not reverse-depend from `fe/packages/*`.
