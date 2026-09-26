# Design Draft — fe-tools-l2-l3-retire-research

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——拆分方案 A0-A5 **已 review lock**（5 轮 readiness review：R1-R4 全 findings 修正 + R5 收敛——F-R1-1 序列化方案 b 实证 / F-R2-1 签名不一致 / F-R3-1 A0 4 处改造点 / F-R4-1/2 caller 分布 + getPages 门控）。基于 source-audit（L2/L3/compat caller 分布 + 门控链条）。

## 1. 拆分方案（A0-A5 渐进子 Action）

详见 [source-audit.md](source-audit.md) §5。核心依赖链：

```
A0（worker ctx 直传——根门控）
  ↓ 解锁
A1（logic parse-walk）/ A2（view parse-walk）/ A3（style parse-walk）—— 并行
  ↓ 解锁
A4（compat 写退役）
  ↓ 解锁
A5（singleton/Proxy 退役——L2 本体）
```

### D-LR-1 — A0 worker 引擎 ctx 直传（根门控）

- **scope**：中-大（聚焦单一改造——不须拆子步骤）
- **内容**：worker input 加 ctx（或 storeInfo 替代为 ctx data）+ defineEngine 透传 + worker 内重建 readContent
- **门控**：PackerContext 形状（readContent function 不可序列化——须拆 ctx 为 data + readContent 重建）
- **解锁**：A1/A2/A3 worker 路径
- **改造点 4 处**（F-R3-1——resetStoreInfo caller）：emit-engine.ts:12 + logic/index.ts:275 + view/index.ts:192 + style/index.ts:57——方案 b 改为 `buildPackerContext(storeInfo data)` + 透传 parse-walk ctx
- **scope 评估**：A0 单一改造（storeInfo→ctx data + 重建 PackerContext）——不须拆子步骤（4 处 caller 同构改造 + defineEngine 透传统一）

### D-LR-2 — A1/A2/A3 parse-walk 迁移（并行，门控 A0）

**签名不一致注记（F-R2-1）**：三者签名各异，加 ctx 参数须各自处理（非统一签名）：
- `logicParseWalk(source, modulePath, pagePath, sourceFile, packageName, extraInfoCode, options)`——7 参
- `viewParseWalk(pageModule, options, select?)`——3 参
- `buildCompileCss(module, compiledPaths?, options?)`——3 参（**style 用 buildCompileCss 非 styleParseWalk**）

- **A1 logic**：3 文件（parse-walk + index + registry-impl），6-7 getters。路径：registry-impl:33（主线程 _ctx 可用）+ logic/index.ts:211（worker——须 A0）+ logic-loader.spec:53（测试直调）
- **A2 view**：~5 文件（parse-walk + index + wxml/compile + load/paths + load/template），8 getters。路径：view/index.ts:126/137 compileML（worker——须 A0）
- **A3 style**：2 文件（parse-walk + index），7 getters。路径：style/index.ts:30 + parse-walk.ts:270 递归（worker——须 A0）。style 用 `buildCompileCss`（非 styleParseWalk）

### D-LR-3 — A4 compat 写退役（门控 A1-A3）

- **scope**：大（112 caller 迁移——测试 fixture 大量）
- **内容**：storeInfo wrapper 删 + 测试 fixture 改 ctx 直传
- **门控**：A1/A2/A3 完成（L2 getters caller=0 后）
- **caller 分布**（F-R4-1）：src 3 文件（env-compute/env.ts/project-store——orchestrate 链路 project-store 调 computeStoreInfo 非 wrapper，scratch-internalize 已改）+ __tests__ ~10 文件（compat mkdtemp 依赖——**A4 主迁移**）
- **注记**：orchestrate 链路已不调 wrapper（scratch-internalize 改 storeInfoCtx 不设 state.scratch）——A4 主要是测试 fixture compat mkdtemp 迁移

### D-LR-4 — A5 singleton/Proxy 退役（门控 A1-A4）

- **scope**：小（env.ts 删 singleton + Proxy + 15 getters）
- **内容**：defaultCompilerContext + pathInfo/configInfo Proxy + 15 getters 删
- **门控**：A1-A4 全完成（caller=0）
- **getPages 特殊门控**（F-R4-2）：getPages 是 env.ts L2 薄壳（调 getPagesImpl 读 ALS configInfo）——27 文件 caller（22 __tests__ + src）。A5 删 getPages 须先迁移这些 caller（A4 测试 fixture 迁移含 getPages caller，或 A5 前置 getPages 迁移子步骤）

## 2. 根门控：PackerContext 序列化（A0）

### D-LR-5 — 序列化方案候选

**问题**：PackerContext 含 `readContent: (path) => string`（function，不可序列化）。worker 独立线程——ctx 须经序列化透传。

**方案候选**（source-audit §6）：
- **a：ctx 拆 data + readContent 重建**——worker input 传 ctx data（workPath/targetPath/fileTypes）+ worker 内重建 readContent（fs.readFileSync）。resolveAlias/resolveNpm 是 stub（D-PCS-1 deferred）——可重建。
- **b：storeInfo 替代为 ctx data**（**锁定**——F-R1-1 实证）——buildResetStoreInfoData 改输出 ctx data + worker 内重建 readContent + 建 PackerContext。resetStoreInfo 改为 resetContext（建 PackerContext 非 ALS singleton）。复用 storeInfo 序列化机制，最小改动透传路径。
- **c：ALS 模型改 worker 内 ALS**——worker 自己 ALS（非主线程透传）。但 worker 独立线程 ALS 与主线程 ALS 隔离（现状 resetStoreInfo 就是 worker ALS 恢复）——本质同现状。

**锁定**：方案 b（storeInfo → ctx data，worker 重建 PackerContext）——F-R1-1 实证（ResetStoreInfoOptions 纯 data + node:worker_threads 序列化 + resetStoreInfo→buildPackerContext 改造路径）。

**方案 b 可行性实证（F-R1-1）**：
- `ResetStoreInfoOptions`（env-compute:285）已纯 data（pathInfo/configInfo/compilerOptions/dependencyGraph——**无 function**，可序列化）✓
- worker 经 `node:worker_threads`（executor.ts:1 `new Worker`）+ input structuredClone 序列化透传——storeInfo 是 input 字段（data only）✓
- `resetStoreInfo`（env.ts:104）现状写 ALS singleton（pathInfo/configInfo/compilerOptions/graph/npmResolver）——方案 b 改为 `buildPackerContext`（data → PackerContext，重建 `readContent: fs.readFileSync` + `resolveAlias/resolveNpm` stub D-PCS-1 deferred）
- parse-walk 收 ctx 参数（透传）替代 ALS getter 读——A1/A2/A3 核心改动

### D-LR-6 — A0 不可绕过

A0（worker ctx 直传）是 A1/A2/A3 worker 路径的前置——**不可绕过**。logic/index.ts:211 + view/index compileML + style/index 都在 worker 引擎内调 parse-walk——须经 worker ctx 直传。

registry-impl Loader.load 路径（主线程）可独立迁移（_ctx 已在契约）——但 logicParseWalk 签名改须同时处理 worker + 主线程两路径（签名统一）。

## 跨权威一致性（F-R3-2）

- **D-PCS-1 deferred stub**：resolveAlias/resolveNpm 是 stub——worker 可重建（方案 b `buildPackerContext` 重建 readContent + stub）✓
- **D-EL1 L1 纯模块**：env-compute L1 不变（A0 改 env.ts L3 resetStoreInfo + worker 引擎，不改 L1）✓
- **D-SC scratch 流**：scratch 不变（A0 不碰 mkdtemp/state.scratch）✓
- **D-PC config-fixpoint**：buildFixpointCtx 不变（A0 不碰 graph 层）✓

## 3. 风险

1. **A0 scope 大**——worker 序列化 + PackerContext 重建，可能须拆 A0 子步骤
2. **parse-walk 签名改**——logicParseWalk/viewParseWalk/styleParseWalk 加 ctx 参数——测试 fixture 直调（logic-loader.spec:53 等）须同步改
3. **A4 测试 fixture 大量**（112 caller）——迁移工作量
4. **A5 须 caller=0**——A1-A4 全完成后才可删 singleton/Proxy

## 4. Non-scope 守

- 纯 research——不实施代码
- 不 formalize 子 Action（A0-A5 各自独立）
- 不改 worker 模型 / PackerContext 形状 / env.ts

## 5. 结论

L2+L3 退役是大倡议（5 子 Action A0-A5），根门控 A0（worker ctx 直传——PackerContext 序列化）。本 Action 产出拆分方案——后续 A0-A5 各自 formalize + 实施。
