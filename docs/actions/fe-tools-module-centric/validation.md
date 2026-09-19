# Validation — fe-tools-module-centric

Status: **ready（2026-09-19）** — 文档门已对拍；close / 子门实施时复核。

权威参考：[Experience-Review.md](../../Experience-Review.md)

本伞以文档门为主。行为 0 = 无子门授权时产品源码零 diff。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-MF00 | 词汇与顺序 | 对照 README / technical-design：Entry≠Module；D-MF-1 封口条款（含 logic 闭包归 M1 TD）；M1→M2；D-MF-3 子门 ID | A-MF0 | **pass**（2026-09-19） |
| P-MF01 | 权威一致 | README 前置链接 boundaries / emit-layer / packer-research；Goal/Non-goals 无「整包抽 Packer」 | A-MF1 | **pass**（2026-09-19） |
| P-MF02 | 回流 | `docs/fe-tools/architecture-notes.md` Module 中心段含伞指针 + D-MF-1 封口要点 | A-MF2 | **pass**（2026-09-19） |
| P-MF03 | 零越权 diff | `git status` / `git diff -- fe/tools/bundler/src fe/packages` 空（本伞文档门期间） | A-MF3 | **pass**（2026-09-19；无 src 改动） |

## Uncovered

- M1/M2 的 API 形状、logic 闭包伪代码、缓存宿主、消融：属子门。
- page `moduleId` 规范形迁移（带 `/`）与方案 C：另门。

## Actual

| When | What |
| --- | --- |
| 2026-09-19 | review findings 修复后复验：`validate_action` 0/0；人工对拍 P-MF00..03 全 pass（见上）。工作树 `fe/tools/bundler/src`、`fe/packages` 无改动。 |
| 2026-09-19 | 升 **`ready`**（用户授权）。status 仍不授权改 src；下一步 formalize M1。 |
| 2026-09-20 | review M1 R4 修复：roadmap + TD 两处 T1–T5→T1–T7（M1 实际冻结 7 议题）。伞文档同步。 |
| 2026-09-20 | M1 complete：getInvalidatedModules + computeInvalidatedModules 交付；6 测例；行为 0（仅 model/ + spec）。伞仍 `ready`（D-MF-4）；下一步 formalize M2。 |
| 2026-09-20 | M2 `draft` formalized：fe-tools-module-result-cache；承接 M1 脏集 + D-MF-2 缓存宿主另定；D-RC-1..4 待定。伞仍 `ready`。 |
