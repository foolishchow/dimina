# Implementation Plan — fe-tools-view-style-compile-res

Status: **ready（2026-10-08）**

> review R1-R3 修正后，design gate RG4-1/2/3/4 已解（降级 + bare + 默认 successPayload，见 TD D-G4-1..3/8）；RG4-5/6 待 impl 审。步骤已可冻结。

## Steps

| # | Step | Detail | Est |
|---|---|---|---|
| 0 | **Design gate review** | RG4-1/2/3/4 ✅ 已解（review R1-R3 + 降级 D-G4-1/2 + bare D-G4-3 + A-IU-3 拆分 D-G4-8）；RG4-5/6 待 impl 审（ctx plumbing 边界 + emit 不变） | — |
| 1 | Review 门 | 范围边界 = view/index.ts + style/index.ts + stage-channel.ts + ctx 类型(as) + tests | — |
| 2 | 改动生产代码 | ① `view/index.ts`：`compileML` 收集 `ViewCompiledModule[]`（base，dependencies: []，renderBody/wxsBindings undefined，D-G4-1）；`viewCompile` 返回 `{ viewCompileResults }`（勿 spread successPayload，F3）；emit 不变 ② `style/index.ts`：`compileSS` 收集 `StyleCompiledModule[]`（base，dependencies: []，styleScopeId undefined，D-G4-2）；`styleCompile` 返回 `{ styleCompileResults }`；styleEngine 用默认 successPayload（不补，F4）；emit 不变 ③ `stage-channel.ts`：新增 view/style cache 写入块（guarded，bare，D-G4-3） | 2h |
| 3 | 更新/新增测试 | ① stage-channel 写入单测（mock ctx.viewCache/styleCache Map，验证 `set` 调用 + value shape）② no-op 路径（ctx.viewCache undefined → 无 set + 不 crash）③ view/style worker 返回 shape 断言；logic 块回归 | 1.5h |
| 4 | 验证 | P-G401..405 全过（tsc + vitest + 行为 0 全量 + V-PC-5 + stage-channel 单测） | 2h |
| 5 | 回流 | architecture-notes：① view/style worker 返回 ViewCompiledModule/StyleCompiledModule（降级 base，dependencies: []，D-G4-1/2）② stage-channel 三车道 cache 写入统一（bare，D-G4-3）③ styleEngine 用默认 successPayload（不补，F4 纠正）④ G4=数据源+写、G5=实例+plumbing+skip 边界（D-G4-8 A-IU-3 拆分）⑤ 行为 0（no-op 写） | 0.5h |
| 6 | 归档 | 移入 `_archive/complete/`，修复相对链接；STATUS.md 更新 | 0.5h |

## Status

- [x] Step 0（design gate review ✅ RG4-1/2/3/4 已解；RG4-5/6 转 impl 审）
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
- [ ] Step 4
- [ ] Step 5
- [ ] Step 6（归档——Close workflow）

## 前置

- G3（`fe-tools-invalidation-all-kinds`）**complete** ✅
- `fe-tools-incremental-unify` design.draft D-IU-2/3/4/5（设计输入，deferred 但已拍板）
- `fe-tools-packer-core-shape` D-PCS-10 CompiledModule（类型已存在）**complete** ✅
