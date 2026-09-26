# Design
## D-ESD-1 src getter caller 迁 ctx（packer 层已有 ctx——graph/orchestrator 等；compiler 层 worker ctx 建立改 storeInfo data）
## D-ESD-2 runtime 改候选 b——successPayload 在 compile 内调（读 ctx.graph 后 toJSON）+ runtime 读 compileResult.serializedPayload
## D-ESD-3 storeInfo wrapper compat 写 6 条删（纯 compute 返 data）
## D-ESD-4 env.ts singleton 删（defaultCompilerContext + Proxy + 20 getters——L34 re-export 保留）
