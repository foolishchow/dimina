# Requirements — fe-tools-fallback-als-delete

承接 A5b 推迟的 D-SRC-1b 删 fallback ALS（A5b 实证 121 failed——独立函数 caller 不传 ctx）。前置 action 已完成独立函数迁 ctx（`fe-tools-style-parse-walk-ctx-leaf` + `fe-tools-view-parse-walk-ctx-deep` + `fe-tools-singleton-retire-cleanup-final` D-SCF-1-1 logic parse-walk）。

## R-FAD-1 — 删 fallback ALS

删 `ctx?.x ?? ALSGetter()` → `ctx!.x[!]`（ctx 非空断言——worker + 测试 + 独立函数已传全 ctx）。范围 5 文件 34 处：
- **logic parse-walk**（9 处）：ctx?.graph/workPath/targetPath/appId/resolveAlias/npmResolver fallback
- **logic index**（6 处）：ctx?.configInfo/graph/component/workPath fallback
- **view parse-walk**（8 处）：ctx?.graph/component/workPath/targetPath/appId fallback
- **view/wxml/compile.ts**（2 处）：ctx?.workPath/graph fallback
- **style parse-walk**（9 处）：ctx?.graph/component/workPath/targetPath/appId fallback

**ctx.graph 双重非空**：types.ts PackerContext.graph?: DependencyGraph（optional）→ `ctx!.graph!`（helper 变量 `_graph = ctx!.graph!` 保留——A5a deviation D-SIC-dev3 TS quirks）。

**ctx.component function**：`ctx?.component ? ctx.component(X) : getComponent(X)` → `(ctx!.component!)(X)`（ctx.component 是 function）。

**ctx.resolveAlias function**：`ctx?.resolveAlias ?? resolveAppAlias` → `ctx!.resolveAlias!`。

## R-FAD-2 — import 清理

删 fallback 后未用 getter import 删（noUnusedLocals）：
- logic/parse-walk.ts：整行 import 删（getAppId/getDependencyGraph/getNpmResolver/getTargetPath/getWorkPath/resolveAppAlias 全未用）
- logic/index.ts：删 getWorkPath
- style/parse-walk.ts：删 getAppId/getComponent/getDependencyGraph/getTargetPath
- view/parse-walk.ts：删 getAppId/getComponent/getDependencyGraph/getTargetPath/getWorkPath
- view/wxml/compile.ts：删 getWorkPath

## R-FAD-3 — 行为 0 三件套

tsc 0 + vitest 全绿（88/88，flaky solo pass）+ 7-diff=0。删 fallback 后 ctx 必传——独立函数已迁（ctx-leaf/ctx-deep/cleanup-final D-SCF-1-1）+ worker + 测试已传全（A5a D-SRC-1a + A5b D-SRC-3a），无 121 failed（A5b 阻塞根因已解决）。
