# Validation — fe-tools-view-style-cache-skip

Status: **complete（2026-10-09）**

## 验证方法

| ID | 方法 | check | evidence |
|---|---|---|---|
| P-G501 | 代码审阅 | ① `session-state.ts` `PackerSessionState` 含 `viewCache?: Map<string, ViewCompiledModule[]>`（per-page-bundle，D-G5-4'）+ `styleCache?: Map<string, StyleCompiledModule>`（bare）② `orchestrator.ts` state→ctx plumbing 镜像 logic（:171/:181）③ `stage-channel.ts` worker input viewCache/styleCache 快照（`new Map(c)`，F12）+ view 写块 per-page-bundle ④ `git diff` 范围 | ✅ 审阅通过 |
| P-G502 | cache-hit 单测 | `view-style-cache-skip.spec.js` 6 tests：compileSS cache-hit/miss/no-cache + compileML per-page-bundle cache-hit/miss/no-cache；G4 test `view-style-compile-res.spec.js` ① per-page-bundle shape 同步 | ✅ 11 tests pass |
| P-G503 | 行为 0 全量 diff | one-shot build 6 项目 diff=0（无 invalidatedModules + state.viewCache=undefined → 无 cache-hit skip → 全量编译 = G4 行为） | ✅ diff -r = 0（6 项目） |
| P-G504 | tsc + vitest | tsc 0 errors；vitest 84 files / 623 tests 全绿（compile-cli-cache flaky 单跑 pass） | ✅ tsc exit 0；vitest 623/623 |
| P-G505 | V-PC-5 类型约束 | changed files 无 `as any`/`@ts-nocheck`/`[key: string]: unknown` 索引签名新增（`as { viewCache? }` 结构断言允许） | ✅ grep 0 violation |
| P-G506 | watch cache-hit byte-identity 集成 | 两次 build 同项目（build1 填 cache，build2 reuse state + invalidatedModules=[] → cache-hit skip）→ 比 output：**view 0 pages_* diff + style 0 .wxss diff**（per-page-bundle 原序 re-emit 保字节一致） | ✅ view/style byte-identity confirmed（residual 见下） |

### P-G506 residual（out-of-scope，pre-existing）

build2 vs build1 仍有差异，但均为 **pre-G5 既有**（G4 baseline stash 验证同样存在），非 G5 回归：
- **logic cache byte-identity**（7 logic.js diff）：logic `moduleCache`（G3/G4 era）cache-hit re-emit 字节 ≠ 全量——logic cache 独立问题，需独立 Action
- **static-copy on incremental**（22 static files only-in-b1）：`invalidatedModules=[]` 时 build-pipeline 跳静态资源拷贝阶段——build-pipeline 独立问题，需独立 Action

G5 范畴（view/style cache-hit）= byte-identical ✅。

## 流程

1. baseline：`git stash` → build 6 项目 → `git stash pop`
2. new：build 6 项目
3. `diff -r` 两产物目录 = 0
4. vitest 全量（含 cache-hit 单测 + compile-cli-cache flaky 单跑确认）
5. tsc 0 errors
6. cache-hit 单测（mock ctx 注入：① cache-hit skip ② cache-miss 写 ③ no-op ④ logic 回归）

## Readiness gate 验证（draft→ready 前）

design gate RG5-1..4 review 解决（readiness），**实施期 P-G506 反转 D-G5-4→D-G5-4' per-page-bundle**：

| RG5 | 门 | 状态 |
|---|---|---|
| RG5-1 | view cache-hit 递归 emit 语义 | ✅ 已解（D-G5-4' per-page-bundle——存原序 bundle，cache-hit re-emit→字节一致。反转 F6 graph 重建：P-G506 发现 graph direct-only + 无 wxs + 序不一致→不可行） |
| RG5-2 | view dependencies:[] 填充 vs placeholder | ✅ 已解（D-G5-4'：不消费 graph/dependencies，直接用存储 bundle→placeholder） |
| RG5-3 | style cache-hit per-page | ✅ 已解（D-G5-5，0 .wxss diff 实测） |
| RG5-4 | cache-hit 与 intra-build 协同 | ✅ 自动解（cache-hit 跳整 parse-walk→intra-build 不查不写） |

## 行为 0 边界

- **one-shot**：无 invalidatedModules → 无 cache-hit skip → 全量编译 = G4 行为 → diff=0（G4 no-op 边界延续）
- **watch**：cache-hit skip = 行为变更（效率提升）；产物字节一致（cached code/map = 全量结果）——watch 验证靠单测 + 回归（cache-hit 触发 + 字节一致），非 diff=0
