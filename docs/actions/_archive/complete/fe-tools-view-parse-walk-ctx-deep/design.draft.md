# Design — fe-tools-view-parse-walk-ctx-deep

> **状态：ready**——D-VPD-1..3 已实施（行为 0 三件套 ✓）。补走 readiness review。

## 背景

cleanup-final D-SCF-1-1 推迟 view parse-walk 迁（递归 caller 链 + A2 deviation 阻塞）。view parse-walk 有递归 caller 链 + wxml/load 跨层透传 + A2 deviation D-VPM-dev1 撤回。

## D-VPD-1 — compileModule 加 ctx 透传 + A2 deviation 撤回

compileModule(L663) 加 ctx? 末参。**A2 deviation D-VPM-dev1 撤回**：
- A2 原撤回原因：compileModule 不直接用 ctx（compileModuleRender 无 ctx 需求）——noUnusedLocals 报未用
- D-SCF-1-1 须 compileModule 透传 ctx 给 tryModuleCache/mergeWxsModules——**ctx 在调用中用，noUnusedLocals 不报**
- 撤回合理

caller L405/473（compileViewTree 内——ctx 已有）传 ctx。

## D-VPD-2 — tryModuleCache/mergeWxsModules/collectAllWxsModules 加 ctx

- tryModuleCache(L512) 加 ctx? + 内 mergeWxsModules/collectAllWxsModules 传 ctx + caller L694（compileModule 内）传 ctx
- mergeWxsModules(L486) 加 ctx? + 内 collectAllWxsModules 传 ctx + caller 传 ctx
- collectAllWxsModules(L1280) 已有 ctx? + recursive L1302/1314 传 ctx + caller L491/557 传 ctx

## D-VPD-3 — toCompileTemplate/loadTemplates 跨层透传

**跨层透传链**（4 层）：
- compileViewTree(ctx) → viewLoadModule(+ctx) → toCompileTemplate(+ctx) → loadTemplates(LoadCtx) → processIncludedFileWxsDependencies(+ctx)

**toCompileTemplate(compile.ts L31)** 加 ctx? + workPath/getDependencyGraph fallback + **tools.processIncludedFileWxsDependencies 闭包绑定 ctx**（wrapper `(componentTags, includePath, scriptModule, components, processedPaths) => processIncludedFileWxsDependencies(..., ctx)`）。

**processIncludedFileWxsDependencies(L861)** 加 ctx? + L871 getComponent fallback + L879 toCompileTemplate 传 ctx（recursive——processIncludedFileWxsDependencies 内调 toCompileTemplate）。

**orchestrator-live.ts**：processIncludedFileWxsDependencies 是 cycle-break shim（let 变量 runtime 绑定）——let 变量类型加 ctx?（签名一致）+ bindTransformOrchestrator deps 类型跟随。

## 行为 0 论证

ctx optional + fallback ALS 保留——caller 可传可不传。worker 传 ctx（D-SRC-1a）→ ctx 优先。测试不传 ctx → fallback ALS。行为等价。

## 行为 0 三件套（已验证）

- **tsc**：0 error
- **vitest**：88/88 pass（3 flaky solo pass）
- **7-diff**：7 项目全 diff=0 ✓
