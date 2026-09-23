# Validation — fe-tools-view-style-cache-skip

Status: **draft（2026-10-08）**

## 验证方法

| ID | 方法 | check | evidence |
|---|---|---|---|
| P-G501 | 代码审阅 | ① `session-state.ts` `PackerSessionState` 含 `viewCache`/`styleCache` bare Map 字段（D-G5-1）② `orchestrator.ts` state→ctx plumbing 镜像 logic（:172/:182，D-G5-2）③ `stage-channel.ts` worker input viewCache/styleCache 快照（D-G5-2）④ `git diff` 范围 | 审阅通过 |
| P-G502 | stage-channel cache 单测 | mock ctx 注入 viewCache/styleCache + worker 返 cache-hit/miss 场景：① cache-hit skip compile（mock buildCompileCss/viewParseWalk 不被调）② cache-miss 编译 + 写 cache ③ no-op（one-shot 无 cache → 全量）④ logic 块回归 | 单测 pass |
| P-G503 | 行为 0 全量 diff | one-shot build 6 项目 diff=0（无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为；G4 no-op 边界延续到 G5 one-shot） | diff -r = 0 |
| P-G504 | tsc + vitest | tsc 0 errors；vitest 全绿（含 cache-hit 单测 + logic 回归） | tsc exit 0；vitest pass |
| P-G505 | V-PC-5 类型约束 | 无 `any`/`as any`/`@ts-nocheck`/`[key: string]` 索引签名新增（`as { viewCache? }` 结构断言允许） | grep 0 violation |

## 流程

1. baseline：`git stash` → build 6 项目 → `git stash pop`
2. new：build 6 项目
3. `diff -r` 两产物目录 = 0
4. vitest 全量（含 cache-hit 单测 + compile-cli-cache flaky 单跑确认）
5. tsc 0 errors
6. cache-hit 单测（mock ctx 注入：① cache-hit skip ② cache-miss 写 ③ no-op ④ logic 回归）

## Readiness gate 验证（draft→ready 前）

design gate RG5-1..4 须 review 解决，证据记入本表附节：

| RG5 | 门 | 状态 |
|---|---|---|
| RG5-1 | view cache-hit 递归 emit 语义（方向 A graph 'component' 边 / B 整 page blob / C 不跳 discovery） | ⬜ 待决（倾向 A） |
| RG5-2 | view dependencies:[] 填充 vs placeholder（与 RG5-1 联动） | ⬜ 待决（倾向 placeholder + graph 查） |
| RG5-3 | style cache-hit per-page | ✅ 较明确 |
| RG5-4 | cache-hit 与 intra-build 协同（cross-hit 是否写 intra） | ⬜ 待决（倾向不写） |

## 行为 0 边界

- **one-shot**：无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为 → diff=0（G4 no-op 边界延续）
- **watch**：cache-hit skip = 行为变更（效率提升）；产物字节一致（cached code/map = 全量结果）——watch 验证靠单测 + 回归（cache-hit 触发 + 字节一致），非 diff=0
