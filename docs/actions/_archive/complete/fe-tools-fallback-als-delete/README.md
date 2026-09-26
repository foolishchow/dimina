# Action — fe-tools-fallback-als-delete
> **状态：complete**——删 fallback ALS 34 处（parse-walk + index + compile.ts）。须 view/style ctx deep/leaf 前置（已完成）。
## Scope
删 `ctx?.x ?? ALSGetter()` → `ctx!.x`（ctx 必传——worker + 测试 + 独立函数已迁）。
## 行为 0
tsc 0 + vitest 88/88 + 7-diff=0
