# Action — fe-tools-env-singleton-delete
> **状态：complete**（partial——不可逾越阻塞：component function 不可序列化）——env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b + storeInfo wrapper compat 写删。
## Scope
- src getter caller 迁 ctx 读（packer 层已有 ctx——graph/orchestrator/config-compiler/dispatch/config-collector/project-store/emit/define-engine/watch + compiler 层 worker ctx 建立改 storeInfo data）
- runtime 改候选 b（successPayload 在 compile 内调——postMessage 序列化）
- storeInfo wrapper compat 写 6 条删
- env.ts singleton 删（defaultCompilerContext + Proxy + 20 getters——L34 re-export 保留）
## 行为 0
tsc 0 + vitest 88/88 + 7-diff=0
