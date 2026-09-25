# Validation — fe-tools-packer-facade-collaborator

Status: **draft（2026-10-09）**

## Validation Plan（实施后执行）

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-FC1 | 7 collaborator 抽取 | 7 文件归位（store/config-collector + emit/dist-preparer + pipeline/config-compiler-collab + pipeline/npm-builder + pipeline/stage-dispatcher + emit/logic-emitter + emit/publisher）+ git diff -M rename + 逻辑体搬迁 | pending |
| P-FC2a | orchestrate 签名落地 | orchestrator `implements PackerOrchestrator` + 签名 `(ctx, state, options) → EmitEntry[]` + result 消费对齐 | pending |
| P-FC2b | registry 私有化 | createPackerOrchestrator 仅 `{ orchestrate }` + types.ts PackerOrchestrator 删 registry 字段 + logic-loader.spec 6 处伸手改 | pending |
| P-FC3 | OrchestrateRequest 收敛 | 入口 CompileRequest/WatchRequest + orchestrate 调用方（src/index.ts + spec）+ build() 下游 + result 消费对齐 | pending |
| P-FC4 | 行为 0 三件套 | tsc 0 + vitest 全绿（87/647 基线）+ 7 项目 diff=0 | pending |
| P-FC5 | rigor 红线（collaborator 拥有逻辑）| `grep 'await.*\.run(' orchestrator.ts` 非 0 + collaborator 含 sctx 字段设置/lifecycle 事件/错误处理 + git diff -M 非空壳 | pending |
| P-FC6 | ALS 保留 | `grep 'getWorkPath\|getPages\|getAppConfigInfo\|isMiniGame' src/packer/{store,emit,pipeline}/` 非 0 + collaborator 业务逻辑完整 | pending |
| P-FC7 | Non-scope 边界守 | renderer 副作用注册原样（orchestrator.ts:64-72 grep webviewRenderer）+ aspect 穿线保留 + L/C/E NOT wired | pending |
| P-FC8 | types.ts 形状纪律 | collaborator 接口在 types.ts + impl 在 packer/ + types.ts 无 implementation import（守 D-PC-5）| pending |
| P-FC9 | result 消费对齐 | buildResult 字段（appId/name/path/dependencyGraph/buildModel）消费处全对齐（grep result\.appId 等）| pending |
| P-FC10 | orchestrator 行数收敛 | orchestrator.ts ~370 → ~80 行（facade 薄编排 + 委托）| pending |

## 行为 0 边界

- **纯结构重构**：logic 搬迁到 collaborator，无语义改。ALS 直调保留 → build 产物字节不变
- **每相独立 commit + 行为 0 gate**：FC-P1..P6（collaborator 抽取）+ FC-P7a/b（入口收敛）各独立 commit
- **7 项目 diff=0**：collaborator 搬迁不改 build 产物（logic 逐字搬迁，ALS 保留）

## Uncovered（预期声明）

- **renderer 注入点**（F-PA-3，A 切法）——后续 Action
- **aspect 分离**（F-PA-2，C 切法）——collaborator 就位后挂 aspect seam
- **ALS→PackerContext 闭合**（F-PA-4，B 切法）——collaborator shape 就位后高风险轮
- **L/C/E dispatch wiring**（F-PA-5/E）——runtime HMR API 外部阻塞
