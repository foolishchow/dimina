# Requirements — fe-tools-view-parse-walk-ctx-deep

承接 cleanup-final D-SCF-1-1 推迟的 view parse-walk 迁。view parse-walk 有**递归 caller 链**（compileModule → tryModuleCache → mergeWxsModules → collectAllWxsModules）+ **wxml/load 跨层透传**（processIncludedFileWxsDependencies caller 在 loadTemplates 内）+ **A2 deviation D-VPM-dev1 撤回**（compileModule 加 ctx 透传）。

## R-VPD-1 — compileModule 加 ctx 透传（撤回 A2 deviation D-VPM-dev1）

compileModule(L663) 加 ctx? 末参 + caller L405/473 传 ctx。A2 deviation D-VPM-dev1 撤回（原撤回原因：compileModule 不直接用 ctx——noUnusedLocals；但 D-SCF-1-1 须透传 ctx 给 tryModuleCache/mergeWxsModules——ctx 在调用中用，不未用）。

## R-VPD-2 — tryModuleCache/mergeWxsModules/collectAllWxsModules 加 ctx

- tryModuleCache(L512) 加 ctx? + caller L694 传 ctx
- mergeWxsModules(L486) 加 ctx? + caller 传 ctx
- collectAllWxsModules(L1280) 已有 ctx? + recursive caller L1302/1314 传 ctx + caller L491/557 传 ctx

## R-VPD-3 — toCompileTemplate/loadTemplates 跨层透传（LoadCtx）

- toCompileTemplate(compile.ts L31) 加 ctx? + workPath/getDependencyGraph fallback + tools.processIncludedFileWxsDependencies 闭包绑定 ctx
- viewLoadModule(L276) 加 ctx? + L667 caller 传 ctx + L283 toCompileTemplate 传 ctx
- processIncludedFileWxsDependencies(L861) 加 ctx? + L871 getComponent fallback + L879 toCompileTemplate 传 ctx
- orchestrator-live.ts let 变量类型加 ctx（cycle-break shim）

## R-VPD-4 — 行为 0

tsc 0 + vitest 88/88 + 7-diff=0。ctx optional + fallback ALS 保留——行为 0。

## 前置关系

- 承接 cleanup-final D-SCF-1-1 推迟的 view parse-walk 迁
- 是 fallback-als-delete 前置（删 fallback 须 view parse-walk 独立函数已加 ctx）
