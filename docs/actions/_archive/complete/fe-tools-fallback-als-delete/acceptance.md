# Acceptance — fe-tools-fallback-als-delete

## A-FAD-1 — 删 fallback ALS 34 处 ✓ done

5 文件 34 处 `ctx?.x ?? ALSGetter()` → `ctx!.x[!]`：
- logic parse-walk 9 + logic index 6 + view parse-walk 8 + view/wxml/compile.ts 2 + style parse-walk 9
- ctx.graph 双重非空 ctx!.graph!（helper 变量 _graph 保留）
- ctx.component function → (ctx!.component!)(X)
- ctx.resolveAlias function → ctx!.resolveAlias!
- 剩余 fallback 0（grep 确认）

## A-FAD-2 — import 清理 ✓ done

删 fallback 后未用 getter import 删（5 文件）——noUnusedLocals 0 error。

## A-FAD-3 — 行为 0 三件套 ✓ done

tsc 0 + vitest 88/88（3 flaky solo pass）+ 7-diff=0。无 121 failed（A5b 阻塞根因已解决——独立函数已迁 + caller 全传 ctx）。
