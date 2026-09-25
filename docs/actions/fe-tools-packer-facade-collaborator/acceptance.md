# Acceptance — fe-tools-packer-facade-collaborator

Status: **draft（2026-10-09）**

| ID | requirement | 验证项 | 方法 | 状态 |
| --- | --- | --- | --- | --- |
| A-FC1 | R-FC-1 | 7 collaborator 抽取（logic 搬迁非包壳）| collaborator 文件存在 + git diff -M 验逻辑体搬迁 + `grep 'await.*\.run(' orchestrator.ts` 非 0 | pending |
| A-FC2a | R-FC-2 | orchestrate 签名落地（北星不改）| orchestrator `implements PackerOrchestrator` + 签名 `(ctx, state, options) → EmitEntry[]` + result 消费（session/index）对齐 | pending |
| A-FC2b | R-FC-2 | registry 私有化（须北星 interface 改）| createPackerOrchestrator 仅返回 `{ orchestrate }` + types.ts PackerOrchestrator 删 registry 字段 + logic-loader.spec 6 处伸手断言改 | pending |
| A-FC3 | R-FC-3 | OrchestrateRequest 收敛 CompileRequest/WatchRequest | 入口签名改 + orchestrate 调用方（src/index.ts + logic-loader.spec）+ build() 下游对齐 + result 消费（session/index） | pending |
| A-FC4 | R-FC-4 | 行为 0 | tsc 0 + vitest 全绿 + 7 项目 diff=0 | pending |
| A-FC5 | R-FC-5 | Non-scope 边界守 | renderer 副作用注册保留（orchestrator.ts:64-72 原样）+ aspect 穿线保留 + L/C/E NOT wired 保留 | pending |
| A-FC6 | R-FC-6 | types.ts 形状纪律 | collaborator 接口在 types.ts（纯形状）+ impl 在 packer/ 子目录 + types.ts 无 implementation import | pending |
| A-FC7 | rigor 红线 | collaborator 拥有逻辑（非包壳）| collaborator 文件含原 orchestrator 逻辑体（sctx 字段设置 + lifecycle 事件 + 错误处理）+ 非 forward-only | pending |
| A-FC8 | D-FC-4 | ALS 保留（B 留后）| `grep 'getWorkPath\|getPages\|getAppConfigInfo\|isMiniGame' src/packer/{store,emit,pipeline}/` 非 0（ALS 直调保留）+ collaborator 仍拥有业务逻辑 | pending |
