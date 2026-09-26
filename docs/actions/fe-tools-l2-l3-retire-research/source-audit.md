# Source Audit — fe-tools-l2-l3-retire-research

> L2+L3 退役大倡议的 source-audit + 门控分析 + 拆分方案。**研究性 Action——不实施代码**。

## 1. L2 ALS 门面现状（env.ts）

### 1.1 getters 列表（env.ts export，15 个）

| getter | 读源 | caller（compiler/*） |
|---|---|---|
| `getWorkPath` | pathInfo Proxy | view/index, view/parse-walk, wxml/compile, style/parse-walk, logic/index, logic/parse-walk（6） |
| `getDependencyGraph` | getCompilerContext().graph | view/index, view/parse-walk, wxml/compile, style/parse-walk, logic/index, logic/parse-walk（5/6） |
| `getContentByPath` | fs.readFileSync | view/parse-walk, wxml/compile, style/parse-walk, logic/index, logic/registry-impl（5） |
| `getComponent` | graph.getComponent / configInfo | view/parse-walk, style/parse-walk, logic/index（3） |
| `getAppId` | configInfo.appInfo | view/parse-walk, style/parse-walk, logic/parse-walk（3） |
| `getTargetPath` | pathInfo.targetPath | view/parse-walk, style/parse-walk, logic/parse-walk（3） |
| `getViewScriptTags` | compilerOptions | view/parse-walk, wxml/compile, wxml/load/template（3） |
| `getTemplateExts` | compilerOptions | wxml/load/paths, wxml/compile（2） |
| `getViewScriptExts` | compilerOptions | view/parse-walk, wxml/load/paths（2） |
| `getStyleExts` | compilerOptions | style/parse-walk（1） |
| `getAppConfigInfo` | graph.getAppConfigInfo | logic/index（1） |
| `isMiniGame` | getRuntimeType | logic/index（1） |
| `getNpmResolver` | getCompilerContext().npmResolver | logic/parse-walk（1） |
| `resolveAppAlias` | config-fixpoint（读 ALS appInfo） | logic/parse-walk（1） |
| `getPages` | toPackerContext(getCompilerContext()) | env.ts L2（21 文件 47 测试 fixture——非 compiler/*） |

**合计**：15 getters，compiler/* 10 文件 import。

### 1.2 singleton/Proxy 机制

- `defaultCompilerContext: CompilerContext | undefined`（singleton）
- `getCompilerContext()`（懒初始化 singleton）
- `pathInfo: PathInfo` Proxy（路由到 getCompilerContext().pathInfo）
- `configInfo: ConfigInfo` Proxy（路由到 getCompilerContext().configInfo）
- getters 读 `getCompilerContext().xxx`（ALS 活读）

## 2. L3 worker 桥接现状

### 2.1 resetStoreInfo caller（3 处 worker 引擎）

| caller | 位置 | 用途 |
|---|---|---|
| `emit-engine.ts:12` | emit-worker 引擎 | `resetStoreInfo(params.storeInfo)` 搭建上下文（getWorkPath 等可用） |
| `view/index.ts`（import） | view worker 引擎 | worker 上下文恢复 |
| `style/index.ts`（import） | style worker 引擎 | worker 上下文恢复 |
| `logic/index.ts`（import） | logic worker 引擎 | worker 上下文恢复 |

### 2.2 worker 透传路径（storeInfo ALS 恢复）

```
orchestrate → runCompileStage(ctx) → buildResetStoreInfoData(sctx.ctx, sctx.state)
  → input.storeInfo（序列化透传 worker）
worker → resetStoreInfo(storeInfo) → 恢复 defaultCompilerContext singleton
  → parse-walk 读 ALS getter
```

**关键**：worker 经 `storeInfo`（buildResetStoreInfoData 组装）透传——**ctx 不直传 worker**（PackerContext.readContent 是 function，不可序列化）。

## 3. compat 写现状（storeInfo wrapper）

- `storeInfo(workPath, options)` wrapper（env.ts）——调 computeStoreInfo + compat 写 6 条（pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph）
- caller：112 处（src + __tests__）——测试 fixture 大量依赖

## 4. 门控链条

### 4.1 L2 getters 退役门控

```
L2 getters caller=0（compiler/* 不再 import）
  ↑ 门控：compiler/* 迁 PackerContext 参数（10 文件 15 getters 改 ctx 读）
    ↑ 门控：parse-walk 签名加 ctx + 内部 getter 改 ctx 读
      ↑ 门控：worker 引擎 ctx 直传（storeInfo → ctx 替代）
        ↑ 门控：PackerContext 序列化（readContent function 不可序列化——worker 须重建）
```

### 4.2 L3 resetStoreInfo 退役门控

```
resetStoreInfo caller=0
  ↑ 门控：worker 引擎不再用 ALS 恢复（ctx 直传替代）
    ↑ 门控：同 4.1 worker ctx 直传
```

### 4.3 compat 写退役门控

```
storeInfo wrapper caller=0
  ↑ 门控：112 caller 迁移（测试 fixture 大量）
    ↑ 门控：L2 getters 退役后（测试不再依赖 ALS）
```

## 5. 拆分方案（渐进子 Action）

### A0：worker 引擎 ctx 直传（根门控）
- **scope**：大（worker 序列化 + PackerContext.readContent 重建）
- **内容**：worker input 加 ctx（或 storeInfo 替代为 ctx 可序列化形式）+ defineEngine 透传 + worker 内重建 readContent
- **门控**：PackerContext 形状（readContent function 不可序列化——须拆 ctx 为 data + readContent 重建）
- **解锁**：A1/A2/A3 worker 路径

### A1：logic parse-walk 迁移
- **scope**：中（3 文件 logic/parse-walk + index + registry-impl，6-7 getters）
- **内容**：logicParseWalk 加 ctx 参数 + 内部 getter 改 ctx 读 + registry-impl Loader.load 传 _ctx
- **路径**：registry-impl（主线程——_ctx 可用）+ logic/index.ts:211（worker——须 A0 ctx 直传）
- **门控**：A0（worker 路径）

### A2：view parse-walk 迁移
- **scope**：中-大（view/parse-walk + index + wxml/compile + load/paths + load/template，~5 文件 8 getters）
- **内容**：viewParseWalk 加 ctx + 内部 getter 改 ctx 读
- **门控**：A0（worker ctx 直传——view/index compileML 在 worker 引擎）

### A3：style parse-walk 迁移
- **scope**：中（style/parse-walk + index，2 文件 7 getters）
- **内容**：styleParseWalk 加 ctx + 内部 getter 改 ctx 读
- **门控**：A0（worker ctx 直传）

### A4：compat 写退役
- **scope**：大（112 caller 迁移——测试 fixture 大量）
- **内容**：storeInfo wrapper 删 + 测试 fixture 改用 ctx 直传
- **门控**：A1/A2/A3 完成（L2 getters caller=0 后）

### A5：singleton/Proxy 退役（L2 本体）
- **scope**：小（env.ts 删 singleton + Proxy + getters）
- **内容**：defaultCompilerContext + pathInfo/configInfo Proxy + 15 getters 删
- **门控**：A1/A2/A3/A4 全完成（caller=0）

## 6. 根门控：PackerContext 序列化（A0）

**问题**：PackerContext 含 `readContent: (path) => string`（function，不可序列化）。worker 是独立线程——ctx 须经序列化透传。

**方案候选**：
- **a：ctx 拆 data + readContent 重建**——worker input 传 ctx data（workPath/targetPath/fileTypes 等）+ worker 内重建 readContent（fs.readFileSync）。readNpm/resolveAlias 是 stub（D-PCS-1 deferred）——可重建。
- **b：storeInfo 替代为 ctx data**——buildResetStoreInfoData 改输出 ctx data（workPath/targetPath/fileTypes/configData）+ worker 内重建 readContent + 建 PackerContext。resetStoreInfo 改为 resetContext（建 PackerContext 非 ALS singleton）。
- **c：ALS 模型改 worker 内 ALS**——worker 自己 ALS（非主线程透传）。但——worker 独立线程 ALS 与主线程 ALS 隔离（现状 resetStoreInfo 就是 worker ALS 恢复）。

**倾向**：方案 b（storeInfo → ctx data，worker 重建 PackerContext）——最小改动透传路径（复用 storeInfo 序列化机制，改输出 ctx data）。

## 7. 结论

**L2+L3 退役是大倡议**（5 子 Action A0-A5），根门控是 **A0：worker 引擎 ctx 直传**（PackerContext 序列化）。

**不可整体实施**——须按 A0 → A1/A2/A3（并行）→ A4 → A5 渐进。

**本 Action 性质**：research（source-audit + 拆分方案 + 门控分析）——**不实施代码**，产出拆分方案供后续子 Action formalize。
