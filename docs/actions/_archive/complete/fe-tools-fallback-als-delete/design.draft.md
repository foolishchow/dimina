# Design — fe-tools-fallback-als-delete

> **状态：ready**——D-FAD-1..2 已实施（行为 0 三件套 ✓）。补走 readiness review。

## 背景

A5b（`fe-tools-singleton-retire-impl-cleanup`）实证 D-SRC-1b 删 fallback 破坏 121 测试——根因：独立函数（enhanceCSS/collectAllWxsModules/styleLoad 等）caller 不传 ctx。前置 action 已完成独立函数迁 ctx：
- `fe-tools-style-parse-walk-ctx-leaf`：styleLoad 加 ctx optional（叶子）
- `fe-tools-view-parse-walk-ctx-deep`：compileModule/tryModuleCache/mergeWxsModules/collectAllWxsDependencies + wxml/load 跨层透传 + A2 deviation D-VPM-dev1 撤回
- `fe-tools-singleton-retire-cleanup-final` D-SCF-1-1：logic parse-walk 6 函数加 ctx + caller 传

独立函数已迁后——删 fallback 不再 121 failed（caller 全传 ctx）。

## D-FAD-1 — 删 fallback ALS 34 处

`ctx?.x ?? ALSGetter()` → `ctx!.x[!]`（ctx 非空断言）。

**模式替换**（6 类）：
1. `ctx?.graph ?? getDependencyGraph()` → `ctx!.graph!`（helper 变量 _graph 保留——A5a D-SIC-dev3 TS quirks）
2. `ctx?.workPath ?? getWorkPath()` → `ctx!.workPath!`
3. `ctx?.targetPath ?? getTargetPath()` → `ctx!.targetPath!`
4. `ctx?.appId ?? getAppId()` → `ctx!.appId!`
5. `ctx?.configInfo ?? getAppConfigInfo()` → `ctx!.configInfo!`
6. `ctx?.component ? ctx.component(X) : getComponent(X)` → `(ctx!.component!)(X)`（ctx.component function）
7. `ctx?.resolveAlias ?? resolveAppAlias` → `ctx!.resolveAlias!`（ctx.resolveAlias function）
8. `ctx?.npmResolver ?? getNpmResolver()` → `ctx!.npmResolver!`

**范围**（5 文件 39 处——F-R2-1 修正含 ctx!.targetPath!）：
- logic parse-walk 9 + logic index 6 + view parse-walk 8 + view/wxml/compile.ts 2 + style parse-walk 9

## D-FAD-2 — import 清理

删 fallback 后未用 getter import 删（noUnusedLocals 报——TS6133）。5 文件清理（见 requirements R-FAD-2）。

## 行为 0 论证

删 fallback 后 ctx 必传——**ctx 必传安全**：
- worker ctx 传全（D-SRC-1a——logic/view/style index buildPackerContextFromOptions 传全 6 optional）
- 测试传全（D-SRC-3a——15 文件 compileSS/compileML 传 ctx + buildCtxFromStoreInfo helper）
- 独立函数已迁（ctx-leaf + ctx-deep + cleanup-final D-SCF-1-1——caller 全传 ctx）
- 测试不直调独立函数（getJSAbsolutePath/resolveDependencyId/processIncludedFileWxsDependencies/styleLoad/collectAllWxsModules 测试直调 0）

→ 无 121 failed（A5b 阻塞根因已解决）。

## 行为 0 三件套（已验证）

- **tsc**：0 error
- **vitest**：88/88 pass（3 flaky solo pass——compile-cli-cache/lifecycle-integration/view-selective-stages）
- **7-diff**：air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui 全 diff=0 ✓
