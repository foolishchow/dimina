# Design Draft — fe-tools-l2-l3-retire-research

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——拆分方案 A0-A5 待 readiness review lock。基于 source-audit（L2/L3/compat caller 分布 + 门控链条）。

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

- **scope**：大（worker 序列化 + PackerContext.readContent 重建）
- **内容**：worker input 加 ctx（或 storeInfo 替代为 ctx data）+ defineEngine 透传 + worker 内重建 readContent
- **门控**：PackerContext 形状（readContent function 不可序列化——须拆 ctx 为 data + readContent 重建）
- **解锁**：A1/A2/A3 worker 路径

### D-LR-2 — A1/A2/A3 parse-walk 迁移（并行，门控 A0）

- **A1 logic**：3 文件（parse-walk + index + registry-impl），6-7 getters。路径：registry-impl（主线程 _ctx 可用）+ logic/index.ts:211（worker——须 A0）
- **A2 view**：~5 文件（parse-walk + index + wxml/compile + load/paths + load/template），8 getters。路径：view/index compileML（worker——须 A0）
- **A3 style**：2 文件（parse-walk + index），7 getters。路径：style/index（worker——须 A0）

### D-LR-3 — A4 compat 写退役（门控 A1-A3）

- **scope**：大（112 caller 迁移——测试 fixture 大量）
- **内容**：storeInfo wrapper 删 + 测试 fixture 改 ctx 直传
- **门控**：A1/A2/A3 完成（L2 getters caller=0 后）

### D-LR-4 — A5 singleton/Proxy 退役（门控 A1-A4）

- **scope**：小（env.ts 删 singleton + Proxy + 15 getters）
- **内容**：defaultCompilerContext + pathInfo/configInfo Proxy + 15 getters 删
- **门控**：A1-A4 全完成（caller=0）

## 2. 根门控：PackerContext 序列化（A0）

### D-LR-5 — 序列化方案候选

**问题**：PackerContext 含 `readContent: (path) => string`（function，不可序列化）。worker 独立线程——ctx 须经序列化透传。

**方案候选**（source-audit §6）：
- **a：ctx 拆 data + readContent 重建**——worker input 传 ctx data（workPath/targetPath/fileTypes）+ worker 内重建 readContent（fs.readFileSync）。resolveAlias/resolveNpm 是 stub（D-PCS-1 deferred）——可重建。
- **b：storeInfo 替代为 ctx data**（**倾向**）——buildResetStoreInfoData 改输出 ctx data + worker 内重建 readContent + 建 PackerContext。resetStoreInfo 改为 resetContext（建 PackerContext 非 ALS singleton）。复用 storeInfo 序列化机制，最小改动透传路径。
- **c：ALS 模型改 worker 内 ALS**——worker 自己 ALS（非主线程透传）。但 worker 独立线程 ALS 与主线程 ALS 隔离（现状 resetStoreInfo 就是 worker ALS 恢复）——本质同现状。

**倾向**：方案 b（storeInfo → ctx data，worker 重建 PackerContext）——最小改动透传路径。

### D-LR-6 — A0 不可绕过

A0（worker ctx 直传）是 A1/A2/A3 worker 路径的前置——**不可绕过**。logic/index.ts:211 + view/index compileML + style/index 都在 worker 引擎内调 parse-walk——须经 worker ctx 直传。

registry-impl Loader.load 路径（主线程）可独立迁移（_ctx 已在契约）——但 logicParseWalk 签名改须同时处理 worker + 主线程两路径（签名统一）。

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
