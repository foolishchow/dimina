# Acceptance — fe-tools-incremental-chain-residuals-closeout

Status: **draft（2026-10-09）**

## A-IRC1 — watch-runner 实例化 view/style cache（R1, D-IRC-1）

- [ ] `watch-runner.ts:90` 后 `if (!sessionState.viewCache) sessionState.viewCache = new Map()` + `styleCache` 同
- [ ] one-shot 创建点（`index.ts:38` / `build-pipeline.ts:23`）保持 undefined（不动）
- [ ] 外部传入 `state`（已有 cache）不覆盖（`if (!...)` 守卫）

## A-IRC2 — R1 真实 watcher 回归测（D-IRC-5）

- [ ] 经 `createBuildWatcher`（或 watch-runner build path）触发 initial build + rebuild，**不手建 Map**
- [ ] 断言 `sessionState.viewCache` 非空 + `size > 0` + 含 page bundle（key 为 page.path）
- [ ] 断言 `sessionState.styleCache` 非空 + 有写入

## A-IRC3 — style cache-hit 集成 `.css` 字节恒等（R6）

- [ ] `view-style-cache-skip.spec.js` 集成 ① 加 `pages_home_index.css` build1==build2 断言

## A-IRC4 — viewCompileResults 保留 + 标注（R7, D-IRC-2）

- [ ] `viewCompile` 返回 shape 保留 `viewCompileResults`（不从 shape 删）
- [ ] 注释标「HMR-future dirty signal；G5 后 stage-channel 不消费，vestigial-but-intentional」

## A-IRC5 — 集成测 env reset（R8）

- [ ] `view-style-cache-skip.spec.js` integration `afterEach` `delete process.env.DIMINA_COMPILER_DIFF_VERIFY`

## A-IRC6 — docs 导航漂移修（R4）

- [ ] `docs/fe-tools/README.md` packer-context 等状态标注与 STATUS.md（complete）对齐

## A-IRC7 — ensureWxsScan 条件化（R9, SHOULD, D-IRC-3）

- [ ] `view/index.ts compileML` `ensureWxsScan` 移入 `hasMiss` 条件分支；**或**降级 Non-acceptance（记 info，不实施）

## A-IRC8 — 行为 0 + 类型约束

- [ ] one-shot build 6 项目 diff=0（R1 接线后不变）
- [ ] watch 路径 cache 启用 → rebuild 产物 view/style 字节恒等（真实 watcher 集成测）
- [ ] tsc 0 errors；vitest 全绿
- [ ] V-IRC-5：changed files 0 `as any` / 0 `[key: string]: unknown` 新增

## A-IRC9 — 回写 G5 文档 + architecture-notes（R-IRC-8）

- [ ] G5 归档 acceptance A-G51 / validation / architecture-notes G5 条目回写一行（消除"已创建"与代码不一致）

## Non-acceptance

- R3（ctx 类型三分）——HMR 前接受（架构笔记保持可见）
- R5（首次 reconcile 可读性）——非缺陷
- X1（G4 归档 acceptance A-G43 per-page-bundle drift）——归档不可变（"complete=终态"），architecture-notes G5 条目 bridge
- R2（logic/static watch diff）——已降级（人工空 invalidated 场景假象，真实路径 diff=0）
- R9 若 A-IRC7 降级——记 info，不实施
- HMR / load-compile 拆 / worker-runtime 包 / 删 `DIMINA_COMPILER_DIFF_VERIFY`——后续门
- 重写 G4 归档文档 / 重开已 complete Action

## Traceability

- R-IRC-1..8 ↔ A-IRC1..9 ↔ P-IRC-1..7（implementation-plan Step 4）
- residual tracker R1/R6/R7/R8/R4/R9 → fixed；R3/R5/X1/R2 → wontfix/downgraded（Non-acceptance）
