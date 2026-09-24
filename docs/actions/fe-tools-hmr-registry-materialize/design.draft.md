# Design Draft — fe-tools-hmr-registry-materialize

> 本文件是设计草稿。用于 D-REG-1/2/3 锁后产出正式 technical-design。

Status: **draft（2026-10-09）**

## §1 registry 实体化策略（D-REG-1 = D-HMR-3）

### §1.1 现状：emptyRegistry stub

`orchestrator.ts:54`：
```typescript
const emptyRegistry = {
  register() { /* stub D-OR-2 */ },
  get() { return undefined },
  kinds() { return [] as string[] },
}
```
三车道 stub——注册/查询全空。orchestrator 不经 registry 派发，直接调 compile-target stages。

### §1.2 目标：实体 registry

`types.ts:186-215` 已定义：
- `Loader.load(input, ctx) → LoadedModule`
- `Compiler.compile(module, ctx) → CompiledModule`
- `Emitter.emit(entryId, modules, ctx, opts) → EmitEntry` + `produceBuckets?`
- kind → Loader/Compiler/Emitter 映射

实体化 = 注册 logic/view/style/app/component 的 Loader/Compiler/Emitter，orchestrator 经 registry.get(kind) 派发。

### §1.3 方案 A（渐进）vs B（一次性）

**方案 A（渐进）**：registry 实体化 + compile-target 保留 fallback（dual-path），逐步切流量。
- **⚠️ SMPU/H1 经验**：dual-path 有验证缺口风险。H1 D-ED-2 反转推荐 A → locked B（一次性）。
- **但 compile-target 是核心入口**（Listr 前 fail-fast + stage 组装），渐进降风险。

**方案 B（一次性）**：直接删 compile-target compile 段，registry 全面接管。
- **优势**：无 dual-path 验证缺口。
- **风险**：compile-target 是核心入口，一次性风险高（stage 组装 + workerOptions 派生复杂）。

### §1.4 D-REG-1 推荐

**推荐 A（渐进）——但条件化**：
- compile-target 静态段（createCompileTarget）保留（fail-fast + config 组装）
- compile-target compile 段（deriveStagePlan stages → workerOptions → runCompileStage）→ registry 派发
- registry 实体化后，compile-target compile 段变 dead code → 移除
- **非 dual-path**：registry 派发是唯一路径（无 flag 切换），compile-target compile 段直接替换（非保留 fallback）

**区别于 SMPU/H1 dual-path**：这里是「先实体化 registry + 接线 + 验证 + 删 compile-target compile 段」的单向迁移（非 flag 切换 dual-path）。与 H1 locked B 精神一致（一次性替换，无 fallback）。

**⋰ 反转 D-HMR-3 推荐 A → locked 非双路径**（F2 补）：伞 D-HMR-3 推荐 A「compile-target 保留 fallback，逐步切流量」= dual-path。H2 反转：compile-target compile 段直接替换（无 fallback flag），与 H1 D-ED-2 locked B 精神一致（SMPU dual-path 验证缺口经验）。伞 D-HMR-3 须 sync。

**⚠️ F4 补：compile-target 段划分**：
- **保留**：`createCompileTarget`（静态验证——stages fail-fast + requestedStages 派生）
- **替换**：`readLoadBindings`（env 读取——getPages + storeInfo）+ `deriveStagePlan`（纯派生——stages / workerOptions / paths）→ registry 派发（Loader.load → Compiler.compile → Emitter.emit）
- design.draft §1.4 原「compile-target 静态段（createCompileTarget）保留」须明确 readLoadBindings + deriveStagePlan 是 compile 段（替换目标）。

---

## §2 load 归属（D-REG-2）

### §2.1 现状：compile-target readLoadBindings

`compile-target.ts:76` readLoadBindings（env 读取：getPages + getAppConfigInfo + storeInfo）。load 逻辑散在 env.ts + config-fixpoint.ts。

### §2.2 目标：Loader registry

load = parse + walk = 发现依赖。Loader.load(input, ctx) → LoadedModule。
- env.ts load 函数 → Loader 注册（logic Loader = buildJSByPath parse-walk? view Loader = wxml parse?）
- readLoadBindings → Loader.load for app/config?

### §2.3 D-REG-2 design gate

load 归属复杂——logic/view/style 各有不同 load 逻辑（parse-walk）。Loader 注册须映射现有 parse-walk 路径。

**待实证**：现有 parse-walk（logic/view/style）能否包装为 Loader.load？readLoadBindings（config load）是否归 Loader 或独立？

---

## §3 stage 概念归属（D-REG-3）

### §3.1 现状：stage 常量在 pipeline

`compile-stages.ts` COMPILE_STAGE_ORDER + stage 常量。`compile-target.ts` deriveStagePlan 派生 stages。

### §3.2 目标：stage 概念归 model/shared

H2 subsume ③（model→pipeline stage/emit 概念）——stage 常量 + EmitModule 下沉 model/shared。

### §3.3 D-REG-3 design gate

stage 概念是否随 registry 实体化下沉？或 stage 被 registry kind 替代（Loader/Compiler/Emitter 按 kind 派发，非 stage）？

**待 design.draft 详评**：registry kind 派发是否消除 stage 概念？或 stage 保留为 registry 顶层编排？

---

## §4 行为 0 边界

### §4.1 one-shot diff=0

one-shot build 不传 state → registry 派发须产同 compile-target stages 的 compile 结果。Loader/Compiler/Emitter 包装现有 parse-walk/transform/emit 路径（非新逻辑）→ 字节一致。

**⚠️ F7 补：worker invocation pattern 保持**——registry 派发须保 `runCompileStage` 的 worker 调用模式（script / workerOptions / onOutput / IPC 序列化）字节一致。若 registry 改变 worker dispatch 或 IPC 序列化，产物字节可能不同。§5 实证须含「registry 派发 == runCompileStage worker invocation byte-identical」验证。

### §4.2 watch 路径

registry 派发 watch 路径同 compile-target（cache-hit skip 经 ModuleResultCache/viewCache/styleCache，H2 不改 cache 粒度）。

---

## §5 实证结果（2026-10-09）

### H2.1 Loader 包装可行性 — **PARTIAL: 须拆分 monolithic parse-walk**

parse-walk 签名 vs Loader 接口（`load(LoadInput) → Promise<LoadedModule{moduleId,kind,source,dependencies,metadata}>`）：
- `logicParseWalk(source, modulePath, ...) → Promise<LogicParseWalkResult>`——可包装（返 dependencies）
- `viewParseWalk(pageModule, options) → EmitModule[]`——**monolithic**（parse+compile+emit 一函数返 EmitModule[]）
- `buildCompileCss(module, ...) → Promise<StyleCompileResult>`——monolithic（parse @import + compile）

**F-H2-1(medium)**：viewParseWalk / buildCompileCss 是 monolithic（parse+compile+emit 一函数）。H2 registry 分离（Loader.load → Compiler.compile → Emitter.emit）**须拆分 monolithic 函数为 3 阶段**，非"包装现有路径"。design.draft §1.4 "Loader/Compiler/Emitter 包装现有路径（非新逻辑）" understates view/style 复杂度。logic 可包装；view/style 须拆分。

### H2.2 compile-target 段边界 — **PASS ✓**（F4 已验证）

- **保留**：`createCompileTarget`（静态验证——stages fail-fast）
- **替换**：`readLoadBindings`（env 读取）+ `deriveStagePlan`（纯派生 stages/workerOptions/paths）→ registry 派发

### H2.3 env.ts load 函数映射 — **CLARIFY**

env.ts 无 "load"（parse/walk）函数——有 config/accessor（`getCompilerContext`/`getContentByPath`/`getProjectConfig`）。load（parse-walk）在 domain 文件（logic/view/style parse-walk.ts）。

**F-H2-2(low)**：D-REG-2 "env.ts load 函数 → Loader" 不精确——load 在 domain parse-walk，env.ts 提供 PackerContext（config+accessor），Loader.load 接收 ctx 参数。D-REG-2 须 clarify：Loader registry 包装 domain parse-walk，env.ts 退为 PackerContext 提供。

### 实证总结

| # | 实证 | 结果 | 影响 |
| --- | --- | --- | --- |
| 1 | Loader 包装 | PARTIAL | view/style monolithic 须拆分（F-H2-1） |
| 2 | compile-target 边界 | PASS ✓ | F4 段划分确认 |
| 3 | env.ts load 映射 | CLARIFY | load 在 domain，非 env.ts（F-H2-2） |

**D-REG-1 gate**：H2 规模升级——view/style parse-walk 拆分为 L/C/E 三阶段是主要工作量（非"包装"）。待 H2 升 ready 前重评规模。
