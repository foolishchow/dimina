# Action — fe-tools-view-parse-walk-ctx-deep

> **状态：complete**——view parse-walk 递归 caller 链 + wxml/load 跨层透传 + A2 deviation 撤回。

## Scope
- compileModule 加 ctx 透传（撤回 A2 deviation D-VPM-dev1）
- tryModuleCache / mergeWxsModules / collectAllWxsModules 加 ctx
- toCompileTemplate → loadTemplates → processIncludedFileWxsDependencies 跨层透传（LoadCtx 扩 packerCtx?）
- caller 全传 ctx

## 行为 0
tsc 0 + vitest 88/88 + 7-diff=0
