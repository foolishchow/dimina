# Validation — fe-tools-hmr-chain-residuals

Status: **complete（2026-10-09）**

## Validation 执行记录（实施后）

| ID | 验证项 | 命令/方法 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| P-HR1 | registry 生产消费 | `grep -rn "loaderRegistry\.\(get\|kinds\)" src/packer/orchestrator.ts`（非零且非测试）+ registry 实体化单测 | ✅ done（partial） | orchestrator.ts load stage `loaderRegistry.kinds()` + `loaderRegistry.get(kind)` 生产调用点（grep 非零）；registry.ts CompileRegistryImpl/EmitRegistryImpl 实体化（替代 stub）；logic-loader.spec.js 单测断言三 registry 实体化。**partial**：仅 logic Loader 注册（kinds=['logic']）；view/style Loader 注册 blocked（形状适配 Non-scope，见 residual） |
| P-HR2 | L_HMR flag 两态 | 单测：默认关 payload == baseline；开 → L_HMR + changedStages + affectedPages | ✅ done | bin/dev.ts `--hmr` + `DMCC_HMR` env；session/index.ts DevOpts.hmr 透传；preview-adapter.ts `createWebPreviewAdapter({hmr})` + `synthesizeReloadLevel enableHmr: state.hmr`（默认 false=今日行为）。dev-reload.spec.js 既有 18 tests 全 pass（baseline 不变）= 默认关态恒等 |
| P-HR3 | selective 链路级 | 新 spec：两轮 build 经 stage-channel 边界 | ✅ done | `__tests__/view-selective-stages.spec.js`（2 tests）：(a+b+d) viewCache dirty 变 + clean 不变 + 规模=1；(c) selective 产物 == 全量重编字节恒等。复用 build() 全链（orchestrator→stage-channel→worker→compileML） |
| P-HR4 | ctx 断言收敛 | `grep -n "ctx as {" src/compiler/pipeline/stage-channel.ts src/packer/orchestrator.ts` = 0 | ✅ done | types.ts NEW StageChannelContext（16 字段）；stage-channel.ts 12 处 + orchestrator.ts 20 处 `ctx as { field }` → `sctx.field`/`sctx.field = x`。grep `ctx as {` 在两文件 = 0（唯一剩 types.ts:92 注释行） |
| P-HR5 | ③ import 消解 | `grep -n "pipeline/" src/model/invalidation.ts` = 0 | ✅ done | NEW src/model/stage-order.ts（COMPILE_STAGE_ORDER 定义迁 pipeline→model）；invalidation.ts:69 + compile-stages.ts:1 + compile-target.ts 全改 import model。`grep pipeline/ src/model/invalidation.ts` = 0（③a 消解） |
| P-HR6 | 行为 0 三件套 | tsc 0 + vitest 全绿 + 6 项目 diff=0 | ✅ done | tsc `--noEmit` 0；vitest 87 files 646 tests pass（+view-selective-stages 2 tests）；6 项目（base/subpackages/mpx-demo/vant/weui/taro-todo）one-shot `diff -r` baseline = 0；V-PC-5 0 新 as any/索引签名 |
| P-HR7 | tracker 同步 | close 时状态更新 | ✅ done | tracker F-HR-1 partial（kinds/get 消费 ✓，view/style 注册 deferred）+ F-HR-2 fixed（通道补齐，默认 true deferred）+ F-HR-3 fixed（selective 证据 ✓ + ③a fixed）+ R3 fixed + ③a fixed（③b/③c open） |

## 行为 0 边界（本 Action 特别声明）

- **one-shot diff=0**：registry 接线 / flag 透传默认态不得改变 build 产物字节（P-HR6 ✓）
- **reload payload 语义**：L_HMR flag 默认关时 `synthesizeReloadLevel` 输出与 baseline 逐字段恒等（P-HR2 ✓ — dev-reload.spec.js 18 tests 全 pass）
- **验证档位声明**（§1 教训落实）：P-HR1/3/4/5 均达"证据"档（非 grep-only）——P-HR1 单测 + 生产调用；P-HR3 新 spec 两轮 build；P-HR4 tsc + grep=0；P-HR5 grep=0 + vitest

## Residual（close 时显式声明）

- **R-HR-1 (b)/(c)**：view/style Loader 注册 + 阶段函数注册 blocked——预研 ② 发现 view/style 阶段函数（`viewLoadModule`/`styleLoad`/`compileModuleRender`/`styleCompile`）需 page/继承上下文，不 fit 单 module `Loader.load(input, ctx)`/`Compiler.compile(module, ctx)` 接口。全量注册须 types.ts 接口演进（LoadedModule/Compiler 形状变更）= 本 Action **Non-scope**（requirements §Non-scope "logicLoader sourcemap/types.ts 形状变更——独立评估"）。**deferred to 后续门**（接口演进 Action）。
- **F-HR-2 默认 true**：通道补齐 ✓（flag-gated 默认关=今日）；默认 true deferred（runtime HMR API 就绪后翻 flag）——runtime-side，外部阻塞
- **③b/③c**：③b compile-cache.ts:5 model import（residual，D-HR-1 后续门评）；③c convergence.ts:3 type-only（runtime 无害，residual）
- **R-HR-6 runtime cycle**（SHOULD，非 MUST）：0 runtime cycle ✓（flag 默认关）；runtime partial update 是运行时侧，外部阻塞

## Uncovered（预期声明）

- L_HMR 默认开启的端到端（runtime-side downgrade 是运行时侧）——flag 开态只验 payload 合成，不验容器消费
- registry dispatch 全替换（D-HR-1 选项 A）——本 Action locked B，A 留后续门
- view/style Loader 形状适配 + 阶段函数 fit——Non-scope（接口演进），deferred to 后续门
