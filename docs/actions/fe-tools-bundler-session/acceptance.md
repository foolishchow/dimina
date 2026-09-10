# Acceptance — fe-tools-bundler-session

Status: `draft` — rewrite pending freeze. Old L0-plugin rows removed from MUST path.

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BS01 | R-BC1 | `createBundler` → `.build` / `.watch` / `.dev` 可调用；会话持有单一 lifecycle | 规格 + 测例 | pending |
| A-BS02 | R-BC2 | `dimina-cli build` / `build -w` / `dev` 经 session，无平行手拼编排 | bin 接线审查 | pending |
| A-BS03 | R-BC3 | 既有 lifecycle / watch / build-error / CLI 契约测例通过 | vitest + 冒烟 | pending |
| A-BS04 | R-BC4 | default `build` 与 `./watch` 导出仍可用 | exports + 测例 | pending |
| A-BS05 | R-BC5 | bundler test + CLI build/dev 冒烟 | validation 记录 | pending |
| A-BS06 | R-BC6 | [stages.draft.md](./stages.draft.md) 与今日 `runBuild`/`env` 对照可读、无 plugin API 承诺 | 文档审查 | pending |
