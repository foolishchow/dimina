# fe-tools-env-l1-extract

- Action: `fe-tools-env-l1-extract`
- Status: `draft`
- Created: 2026-10-10
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-EL1-1..N 待 lock**——L1 函数清单 + 迁出策略 + 死代码清理 + toPackerContext/CompilerContext type 处理）
- 实施计划：[implementation-plan.md](implementation-plan.md)
- 验证：[validation.md](validation.md)
- 背景：[`storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1（env.ts 三层混合）+ [`fe-tools-storeinfo-collapse`](../_archive/complete/fe-tools-storeinfo-collapse/README.md)（阶段 2 backflow：L1 迁出推迟）

## Background

`fe-tools-storeinfo-collapse` 归档时记录 backflow：**阶段 2（L1 迁出）推迟为后续 initiative**。env.ts 当前是 L1（计算）+ L2（ALS 门面 singleton + Proxy + getters）+ L3（worker 桥接 resetStoreInfo）三层混合（概念分析 §1 L21 表）。

L1 计算层包含：
- **纯函数**：`normalizeFileTypes`（+ `normalizeExt`/`normalizeTag`/`mergeUnique` + 常量 `DEFAULT_*`/`RESERVED_EXTS`）、`computePathInfo`、`buildPackerContext`、`buildResetStoreInfoData`、`getAppStyleScopeId`、`getContentByPath`
- **L1+L2 混合**：`storeInfo`（纯计算 + compat 写——backflow 保留）、`storeInfoCtx`（调 storeInfo）、`toPackerContext`（收 CompilerContext shape）、薄壳委托 config-fixpoint（`storeProjectConfig`/`storeAppConfig`/`storePageConfig`/`resolveAppAlias`/`getPages`/`createInitialDependencyGraph`/`storePathInfo`——从 ALS 读再调 config-fixpoint/写 Proxy）

**死代码发现**（source-audit）：`storeProjectConfig`/`storeAppConfig`/`storePageConfig`/`createInitialDependencyGraph`/`storePathInfo` 在 src/ **无 caller**（config-fixpoint 已被 `graph.build`/`graph.reconcile` 取代；仅 `__tests__/env.spec.js` 测 `storeProjectConfig`）。`toPackerContext` 无外部 caller（仅 env.ts 内部）。**`getPages` 保留**（src/ 0 caller 但测试 21 文件 47 调用点——L2 getter 保留）。`PageConfig`/`ComponentConfig` re-export + `getCompilerContext` export 删（0 外部消费）。

## Goal

env.ts L1 计算层迁出到纯模块 `src/packer/store/env-compute.ts`；env.ts 退化为 **L2 ALS 门面**（singleton + Proxy + getters）+ **L3 worker 桥接**（resetStoreInfo）+ **storeInfo wrapper**（调 env-compute + compat 写保留 backflow）+ re-export L1（最小改动，消费方 import 不变）。死代码清理（薄壳委托 5 函数 + `toPackerContext` 若内部化）。

env.ts 三层混合 → L2/L3 薄门面，L1 纯模块卫生（可独立测试，无 ALS 副作用）。

## Non-goals

- **compat 写不动**（backflow 保留——storeInfo wrapper 保留 compat 写，推迟为阶段 3）
- **L2/L3 不动**（getters/resetStoreInfo/singleton/Proxy 保留——阶段 3 worker ALS 退役）
- **compiler/* 不动**（parse-walk 仍读 ALS getters——阶段 3 迁 PackerContext 参数）
- **PackerContext 构造 dedup 不处理**（buildPackerContext/buildFixpointCtx/toPackerContext 三同质——独立 follow-up）
- **scratch 内化不处理**（DiskOutput.publish follow-up）
- **config-fixpoint 不动**（已是纯模块，薄壳迁出/删除不改 config-fixpoint 本身）

## Design inputs

- 概念分析：[`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) §1（env.ts 三层定位表）
- storeinfo-collapse backflow：[`fe-tools-storeinfo-collapse`](../_archive/complete/fe-tools-storeinfo-collapse/README.md) Non-goals（阶段 2 L1 迁出）
- env.ts 现状：`src/packer/store/env.ts`（L1 函数 + L2 singleton/Proxy/getters + L3 resetStoreInfo）
- env.ts 消费方：~20 文件 import（getters + resetStoreInfo + buildResetStoreInfoData + buildPackerContext）

## Requirements

详见 [requirements.md](requirements.md)。

## Proposed design

详见 [design.draft.md](design.draft.md)。核心：

1. 新建 `src/packer/store/env-compute.ts`（L1 纯函数 + 常量 + type）
2. env.ts 退化为 re-export L1 + L2/L3 + storeInfo wrapper（compat 写保留）
3. 死代码清理（薄壳委托 5 函数 + toPackerContext 若内部化）

## Readiness gaps

**3 项**（design §4 风险）：

1. **storeInfo 拆 computeStoreInfo + wrapper**：storeInfo 是 L1+L2 混合（计算 + compat 写）。迁 L1 须拆纯计算部分（computeStoreInfo）+ env.ts wrapper（compat 写）。compat 写调 getCompilerContext（L2 singleton）——wrapper 留 env.ts。须确认 computeStoreInfo 签名（收 PackerContext? workPath? options?）。
2. **toPackerContext / CompilerContext type**：toPackerContext 收 CompilerContext（env.ts 内部 type）。无外部 caller。迁 env-compute 须 export CompilerContext type 或改 toPackerContext 收 raw 字段，或内部化（仅 computeStoreInfo 用，不 export）。须设计决策。
3. **死代码清理测试影响**：storeProjectConfig 等 5 函数仅 env.spec 测。删须改 env.spec（测 config-fixpoint 直接，或删薄壳测试）。须确认 env.spec 覆盖 config-fixpoint.readProjectConfig 逻辑（薄壳透传）。

## Closure conditions

- 全 MUST Acceptance passed with evidence
- 行为 0 三件套绿（tsc 0 + vitest 88/88 + 7-diff=0）
- env.ts L1 函数 caller=0（全迁 env-compute 或删）+ 死代码 caller=0
- compat 写保留 backflow（storeInfo wrapper 不动 compat 写）
- backflow：阶段 3（worker ALS 退役）+ scratch 内化 + PackerContext dedup 留 follow-up
