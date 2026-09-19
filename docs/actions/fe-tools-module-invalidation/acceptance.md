# Acceptance — fe-tools-module-invalidation

Status: **草案（随 Action `ready`）** — A-IV0/A-IV1 文档门 pass；IV1 实施项 pending。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-IV0 | R-IV0 | TD 显式继承 D-MF-1 七条；Non-goals 含不改 emit、不替换 Entry API | P-IV00 | **pass**（2026-09-19） |
| A-IV1 | R-IV1 | D-IV-1..9 冻结；算法与双挂 API 成文 | P-IV01 | **pass**（文档，2026-09-19） |
| A-IV2 | R-IV2 | 单测 5 案（对齐 TD §2.2 + D-IV-3）：共享 JS 进集；page.js 进集；wxml 不进集；**component.js 进集但页 moduleId 不进集**（验 D-IV-6）；**未知文件 → [] 不抛**（验 D-IV-3）；vitest 相关套件绿 | P-IV02 | pending |
| A-IV3 | R-IV3 | 落点符合 D-IV-2；无 `fe/packages` diff；无 Packer 抽取 | P-IV03 | pending |
| A-IV4 | R-IV0 / D-IV-5 | logic emit 路径行为 0（仅加法 API） | P-IV04 | pending |

## Non-acceptance

- 用 `getAffectedEntries` 冒充本门交付。
- 改 page/`modDefine` moduleId 形。
- 把 view 变更放进本 API 返回集却无设计变更授权。
- 未授 `in_progress` 即改 `src`。
