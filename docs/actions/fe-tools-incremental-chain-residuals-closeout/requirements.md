# Requirements — fe-tools-incremental-chain-residuals-closeout

Status: **draft（2026-10-09）**

## 问题

三轮回顾（[9-24](../../fe-tools/2026-09-24-packer-incremental-retrospect.md) / [10-09 G5](../../fe-tools/2026-10-09-g5-impl-closeout-retrospect.md) / [10-09 G1-G5](../../fe-tools/2026-10-09-g1-g5-broad-retrospect.md)）consolidate 10 条 residual（[tracker](../../fe-tools/incremental-chain-residuals.md)）。核心缺口 R1：G5 算法齐备但 watch-runner 不实例化 cache → 生产效能空转。余皆 low/info 小修。

## 需求

### R-IRC-1（MUST，R1）— watch-runner 实例化 view/style cache

`watch-runner.ts` 创建 session 后（`new PackerSessionState()` 后）**赋值** `sessionState.viewCache = new Map()` + `sessionState.styleCache = new Map()`，使生产 watch 路径 cross-rebuild cache 生效。**仅 watch 路径**——one-shot 创建点（`index.ts:38` / `build-pipeline.ts:23`）保持 `undefined`（no-op→diff=0 边界延续）。

### R-IRC-2（MUST，R6）— style cache-hit 集成 `.css` 字节恒等断言

`view-style-cache-skip.spec.js` 集成测 ①（cache-hit 含 transitive subs）加断言：`pages_home_index.css` build1==build2 字节一致。

### R-IRC-3（MUST，R7）— `viewCompileResults` 保留 + 标注

`viewCompileResults` 保留于 `viewCompile` 返回 shape（不从 shape 删——避免破 worker response 消费者 + HMR 未来用 dirty 信号）。加注释标「HMR-future dirty signal；G5 后 stage-channel 不消费，vestigial 但有意保留」。

### R-IRC-4（MUST，R8）— 集成测 env reset

`view-style-cache-skip.spec.js` integration `afterEach` 加 `delete process.env.DIMINA_COMPILER_DIFF_VERIFY`（或保存/恢复原值），防泄漏后续 test。

### R-IRC-5（MUST，R4）— docs 导航漂移修

`docs/fe-tools/README.md` 核查 packer-context 等状态标注，与 STATUS.md 对齐（complete 不标 draft）。

### R-IRC-6（SHOULD，R9）— `ensureWxsScan` 条件化

`view/index.ts compileML` 顶部 `ensureWxsScan` 移入条件分支——仅当至少一 page cache-miss 时才调（全 cache-hit 跳过）。若实现非平凡则降级为 Non-acceptance（记 info）。

### R-IRC-7（MUST）— 行为 0 不变

one-shot 全量 build 6 项目 diff=0（R1 接线后 one-shot 仍 undefined→no-op→全量；不变）。watch 路径 cache 启用后字节恒等（既有集成测覆盖，R1 接线不改字节恒等）。

### R-IRC-8（MUST）— 回写 architecture-notes + IRC docs（G5 归档不重写）

architecture-notes + IRC acceptance/validation 记录：R1 接线修正了 G5 acceptance A-G51 的「watch-runner 创建实例」叙事超前（G5 closeout 时该叙事超前于代码，F1 回顾抓出；IRC 接线后叙事与代码一致）。**G5 归档文档不重写**（immutable，与 X1 Non-acceptance 同原则——归档 complete 不可变）。

## 约束

- 行为 0（one-shot diff=0 不变）——R1 仅 watch 路径接线，one-shot 创建点不动。
- 类型约束（V-PC-5）：无 `as any` / `[key: string]: unknown` 新增（`as { viewCache? }` 结构断言允许，与现有模式同）。
- 不重写 G4 归档文档（X1 Non-acceptance，architecture-notes bridge）。
- 不重开已 complete Action。

## Non-scope

- R3（ctx 类型三分）——HMR 前接受。
- R5（首次 reconcile 可读性）——非缺陷。
- X1（G4 归档 doc drift）——归档不可变。
- R2（logic/static watch diff）——已降级（人工空场景假象）。
- HMR / load-compile 拆 / worker-runtime 包 / 删 `DIMINA_COMPILER_DIFF_VERIFY`——后续门。
