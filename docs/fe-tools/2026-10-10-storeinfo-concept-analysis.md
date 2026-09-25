# storeInfo / PackerContext / env.ts 概念分析

> 2026-10-10 · pre-Action 分析（fe-tools-packer-north-star-evolution 闭合后揭示的 backflow 讨论）

## 背景

`fe-tools-packer-north-star-evolution`（D-NS-1..6）闭合后，P-NS6 audit 揭示 **storeInfo compat 写 load-bearing**——design 预设删 compat 写经实证 REVERT（删则 `mkdirSync(undefined)` 崩 + 7 diff≠0）。backflow 推迟为后续 initiative（R-NS8）。

启动 backflow 讨论时，逐步发现：compat 写不是孤立问题，它根植于 **storeInfo / PackerContext / env.ts 三概念的身份模糊与重叠**。本文档梳理这三者的当前定位、冗余实证、与塌缩路径，供后续 Action formalize 决策。

---

## 1. 三概念的当前定位

### 1.1 env.ts —— 混合职责的「环境枢纽」模块

`packer/store/env.ts` 身兼三层职责，身份模糊：

| 职责层 | 代表符号 | 性质 | 对外依赖 |
|---|---|---|---|
| **L1 计算层** | `storeInfo` / `buildPackerContext` / `toPackerContext` / `computePathInfo` / `normalizeFileTypes` / `createInitialDependencyGraph` | 纯计算（storeInfo 有 compat 写副作用除外） | packer 内（project-store.load 调 storeInfo；index.ts 调 buildPackerContext） |
| **L2 ALS singleton 门面层** | `getCompilerContext` / `defaultCompilerContext` + ~20 getters（`getWorkPath`/`getTargetPath`/`getAppId`/`getTemplateExts`/`getStyleExts`/`getViewScriptExts`/`getViewScriptTags`/`getDependencyGraph`/`getNpmResolver`/`getAppConfigInfo`/`getContentByPath`/`getRuntimeType`/`isMiniGame`/`getComponent`/`resolveAppAlias`/...）+ `pathInfo`/`configInfo` Proxy | 模块 singleton 读写（有状态） | **packer 外部重依赖**（compiler/* parse-walk + aspect + emit.ts） |
| **L3 worker 桥接层** | `resetStoreInfo`（worker 写 defaultCompilerContext） | 跨线程填充 | compiler/* worker entry（logic/style/view index + emit-engine） |

**定位矛盾**：env.ts 既是「计算中枢」（纯函数职责，对齐北星 types.ts 纯 shape），又是「ALS 运行时门面」（有状态 singleton，worker/main 经 getters 读），又是「跨线程桥接」——一个模块混了**纯计算 + 有状态 singleton + 跨线程桥接**三种身份。它是 packer 对 compiler/* 的**环境门面**（外部不调 storeInfo，但重度依赖 getters）。

### 1.2 storeInfo —— 矛盾身份的「config bootstrap」函数

`storeInfo(workPath, {fileTypes, graph})` 当前承担**双重角色**，自相矛盾：

| 角色 | 行为 | 消费方 | B 切法状态 |
|---|---|---|---|
| **计算角色**（canonical） | 输入 workPath+fileTypes+graph → 建/reconcile PackerGraph（config fixpoint）→ 输出 `{pathInfo, configInfo, compilerOptions, dependencyGraph}` | `project-store.load` → `sctx.storeInfo` → collaborator 显式读（config-compiler-collab/npm-builder/stage-dispatcher/publisher） | ✓ 已迁（PC-B4c4/B2/B3a/B7） |
| **ALS 填充角色**（compat 副作用） | L209-219 把同批结果写回 `defaultCompilerContext` singleton | 主线程 getters → createDist(targetPath)/project-store.getDependencyGraph/publishToDist fallback/npm-builder fallback | ✗ 未迁（load-bearing） |

**身份矛盾**：storeInfo 表面是「一次性消耗品」（函数返回值，pipeline 当轮用完），暗中是「singleton 持久 mutator」（compat 写 mutate `defaultCompilerContext`，跨 pipeline run 驻留）。一个函数不该同时是「用完即弃的产物」+「留下隐式驻留态的副作用」——这让 storeInfo 的定位模糊：它是计算？是状态管理？是 ALS 填充？三者都是，三者都不是。

### 1.3 PackerContext —— I/O 能力 interface（纯 shape）

```ts
// types.ts
export interface PackerContext {
  workPath: string
  targetPath: string
  readContent: (path: string) => string
  resolveAlias: (src: string) => string | null
  resolveNpm: (src: string, baseFile: string) => string
  fileTypes: PackerFileTypes
  // graph/moduleCache/configInfo 不在此（D-PCS-6：在 OrchestratorState）
}
```

**定位**：描述「能读什么 + 在哪 + 文件类型规则」的 I/O 能力 bundle。**纯 interface，无计算，无状态**。不含 graph/configInfo/dependencyGraph（graph 在 OrchestratorState）。

**构造方**（3 个，同质逻辑——本身是 duplication）：
- `buildPackerContext(workPath, targetPath, fileTypes?)`——index.ts L60，从 raw params 建（orchestrate 入口）
- `buildFixpointCtx(workPath, targetPath, compilerOptions, configData)`——config-fixpoint，显式非 ALS
- `toPackerContext(CompilerContext)`——env.ts 内部，从 ALS CompilerContext 建（storeInfo + getters 用）

**消费方**：
- `orchestrate(ctx, state, options)`——北星签名，ctx 显式 PackerContext
- `graph.build/reconcile(ctx)`——config fixpoint 读 `ctx.workPath`/`ctx.readContent`/`ctx.fileTypes`
- `config-fixpoint.ts`——`fc.ctx.workPath`/`fc.ctx.readContent`/`fc.ctx.fileTypes`（显式）

---

## 2. storeInfo 是不是 pipeline 的一次性消耗品？

**不是纯消耗品**——它是「消耗品 + singleton 持久 mutator」的矛盾混合体。

实证：

| 层 | 性质 | 生命周期 | 纯消耗品？ |
|---|---|---|---|
| **返回值**（sctx.storeInfo） | 一次性计算产物 | 每次 orchestrate 调一次（config-collector 单 stage L215），collaborator 当轮消费，下次 store.load 覆盖 | ✓ 是 |
| **compat 写**（L209-219） | module singleton 持久 mutation | `defaultCompilerContext`（L20 `let`，`||=` 创建一次**永不 reset**）跨 orchestrate 持久驻留——每次 storeInfo mutate 它，但**不清理** | ✗ 不是——隐式持久态 |

**矛盾点**：
- **当前 run**：返回值 + compat 写**同源冗余**（都从 localCtx/graph 算出）——compat 写是返回值的「影子 dump」
- **跨 run**（watch 模式 rebuild）：返回值被覆盖（per-run 消耗），但 **compat 写的 singleton 残留上一轮数据**——直到下次 storeInfo 再 mutate。主线程 singleton **永不 reset**（只 `||=` 创建，无 clear）
- **worker 侧**：resetStoreInfo 每次 worker 调用都重写 worker 线程的 defaultCompilerContext（显式 reset 语义）——但**主线程没有 reset**，compat 写是「只增不清」的持久 mutation

**结论**：storeInfo 的 compat 写让它不是纯消耗品。这本身就是概念该塌缩的信号。

---

## 3. sctx.storeInfo 的冗余实证

collaborator 从 `sctx.storeInfo` 读的全部字段，对照 PackerContext + state.graph：

| sctx.storeInfo 字段 | 消费方 | 是否已在别处 |
|---|---|---|---|
| `pathInfo.workPath` | config-compiler-collab/npm-builder/stage-dispatcher | **PackerContext.workPath** ✓ |
| `pathInfo.targetPath` | config-compiler-collab/npm-builder/stage-dispatcher/publisher | **PackerContext.targetPath** ✓ |
| `pathInfo.temporaryTargetPath` | publisher L38 | ✗（PackerContext 无此字段）——**唯一 gap** |
| `compilerOptions.templateExts` | npm-builder/stage-dispatcher | **PackerContext.fileTypes.templateExts** ✓ |
| `compilerOptions.styleExts` | npm-builder/stage-dispatcher | **PackerContext.fileTypes.styleExts** ✓ |
| `compilerOptions.viewScriptExts` | npm-builder/stage-dispatcher | **PackerContext.fileTypes.viewScriptExts** ✓ |
| `compilerOptions.viewScriptTags` | npm-builder/stage-dispatcher | **PackerContext.fileTypes.viewScriptTags** ✓ |
| `compilerOptions.templateDirectivePrefixes` | npm-builder/stage-dispatcher | **PackerContext.fileTypes.directivePrefixes** ✓（仅改名） |
| configInfo/dependencyGraph | —（collaborator 读 state.graph accessors，非 sctx.storeInfo） | **state.graph**（D-NS-1 accessors：getAppId/getAppName/getAppConfigInfo/getConfigData/getPageConfigInfo）✓ |

**结论**：sctx.storeInfo 是 PackerContext + state.graph 的**冗余投影**，唯一缺的字段是 `temporaryTargetPath`。加这一个字段到 PackerContext，sctx.storeInfo **全冗余可消除**。

---

## 4. 概念过多的根因

三个概念（PackerContext + sctx.storeInfo + ALS facade）之所以感觉多，是因为 **sctx.storeInfo 是 storeInfo 矛盾身份的具象**：

- sctx.storeInfo 是 storeInfo「消耗品角色」的产物（返回值 bundle）
- 但 storeInfo 同时偷偷做 singleton mutation（ALS facade 角色的产物，compat 写）
- env.ts 三层混合（计算 + singleton 门面 + worker 桥接）让这三种身份挤在一个模块

**根因链**：
```
storeInfo 矛盾身份（消耗品 + singleton mutator）
  → 产出 sctx.storeInfo（消耗品角色具象）+ compat 写（singleton mutator 角色具象）
  → sctx.storeInfo 冗余于 PackerContext + state.graph（除 temporaryTargetPath）
  → compat 写 load-bearing（喂未迁的 main-thread getter）
  → env.ts 三层混合承载这一切
```

---

## 5. 塌缩愿景：3 → 2 概念

```
现状（3 概念 + env.ts 包 3 层）:
  PackerContext  (I/O 能力)      ← orchestrate ctx 参数
  sctx.storeInfo (config 快照)   ← collaborator 读（冗余投影）
  ALS facade     (singleton getters) ← compiler/* worker 读

塌缩后（2 概念 + storeInfo 退化纯函数）:
  PackerContext  (I/O 能力 + fileTypes + temporaryTargetPath)  ← 直接流给 collaborator
  state.graph    (config 源，D-NS-1 accessors)                ← collaborator 直接读
  storeInfo      → bootstrapGraph(ctx, graph) 纯函数（建/reconcile graph，无输出无副作用）
  ALS facade     → 独立退役（worker 模型，后续 initiative）
```

### 塌缩路径

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | PackerContext 加 `temporaryTargetPath`（+ pathInfo 残留字段） | 关闭唯一 gap |
| 2 | PackerContext 流给 collaborator（经 sctx.ctx 或 deps） | collaborator 有 PackerContext |
| 3 | collaborator 迁：`sctx.storeInfo.pathInfo.X` → `ctx.X`；`sctx.storeInfo.compilerOptions.X` → `ctx.fileTypes.X` | 消 sctx.storeInfo 读者 |
| 4 | storeInfo 签名改 `(PackerContext, state.graph) → void`（建/reconcile graph，无 return 无 compat 写） | storeInfo 退化为纯 graph bootstrap + 消内部 toPackerContext |
| 5 | 删 sctx.storeInfo 字段 + 删 storeInfo 返回值 + 删 compat 写 | **compat 写自然死**（无快照可 dump） |
| 6 | env.ts 拆：storeInfo(graph bootstrap)→ graph 模块；buildPackerContext/normalize→ context 模块；ALS facade→ 待 worker 迁后退役 | env.ts 消亡 |

### 关键洞察

**compat 写不是独立问题——它是 sctx.storeInfo 冗余投影的副作用**。只要 sctx.storeInfo 还作为 collaborator 的 config bundle 存在，storeInfo 就得产出快照 + dump 进 singleton（compat 写）。**消除 sctx.storeInfo，compat 写自然死**——不需要单独「迁 getter 消费方」的 hack。

### storeInfo 身份澄清

```
现状:  storeInfo = 消耗品（返回值）+ 隐式 singleton 持久 mutator（compat 写）  ← 矛盾
塌缩:  storeInfo = 纯 state mutator（state.graph，显式）                      ← 单一身份
```

塌缩后 storeInfo 是 **graph bootstrap 函数**（PackerContext → state.graph build/reconcile），无返回值、无 singleton mutation。state.graph 是 OrchestratorState 的显式状态（合法持久），不是隐藏 singleton。

---

## 6. env.ts 拆解下线的阶段

env.ts 的「拆解下线」是**多阶段过程**，后阶段 gated by compiler/* 上下文访问模型迁移：

| 阶段 | 内容 | 风险 | 此文档坐标 |
|---|---|---|---|
| **阶段 1** | storeInfo 纯化——消 sctx.storeInfo + 删 compat 写（塌缩步 1-5） | 中（~8-10 文件，行为 0 全量验证） | **此 backflow Action 候选 scope** |
| **阶段 2** | L1 计算层迁出（storeInfo/buildPackerContext/normalize → 纯模块；env.ts 退化为 ALS 门面 + worker 桥接） | 低（纯文件搬迁） | 独立 follow-up |
| **阶段 3** | L2+L3 退役（compiler/* parse-walk/compile 签名加 PackerContext 参数；worker entry 从 message 解包后显式传；singleton + getters + Proxy + resetStoreInfo 全删） | **高**（全 compiler/* 签名级重构 + worker 模型调整） | 大 initiative（packer 重构 A/C/E 轨道或独立 Action） |

**阶段 3 的 gating**：L2/L3（singleton + resetStoreInfo）是 worker 模型的伴生物——worker 是独立线程，无法经闭包收上下文，当前靠 resetStoreInfo 填 worker 线程的 defaultCompilerContext。只要 worker 不能显式收上下文，singleton + resetStoreInfo 就必须存在。阶段 3 须 compiler/* 全签名重构（每个 parse-walk/compile 函数加 PackerContext 参数）+ worker 模型调整，blast radius 远超 packer 范围。

---

## 7. scope 取舍

| 选项 | scope | 概念数 | 风险 | 性质 |
|---|---|---|---|---|
| **A 窄 backflow** | 迁 createDist + project-store getter 读 sctx.storeInfo 返回值；删 compat 写 | 仍 3 概念（sctx.storeInfo 留） | 低（4-5 文件） | 补丁——singleton 读换成返回值读，sctx.storeInfo 仍在 |
| **B 塌缩** | 消 sctx.storeInfo：PackerContext 加 temporaryTargetPath + 流给 collaborator + collaborator 迁读 PackerContext + storeInfo 改纯函数 + 删 compat 写 | **2 概念** | 中（~8-10 文件） | 根治——消除 sctx.storeInfo，compat 写自然死 |

**B 更对**——它根治「概念过多」+ 让 compat 写自然死，而非打补丁。且 B 的每步都是行为 0 可守的：
- PackerContext 加字段（additive）
- collaborator 逐个迁（每步独立验证）
- storeInfo 签名改（tsc + diff 守）

**推荐**：此 Action 采用 **B 塌缩** scope。goal 表述：「消除 storeInfo 的矛盾身份与 sctx.storeInfo 冗余投影，使 storeInfo 成为纯 state.graph mutator（无 singleton 副作用），concept 从 3 塌缩至 2（PackerContext + state.graph）；compat 写自然死。worker ALS bridge 保留。」

---

## 8. 待决问题

1. **阶段 1（塌缩）与阶段 2（L1 迁出）是否并？** 倾向不并——阶段 1 核心是「消 sctx.storeInfo + compat 写死」，scope 自洽；L1 迁出是独立模块卫生问题，混进来会让 Action 目标模糊。
2. **PackerContext 构造 duplication（buildPackerContext/buildFixpointCtx/toPackerContext 三同质构造器）** 是否在此 Action 处理？倾向不处理——独立 follow-up（纯 dedup）。
3. **worker ALS bridge（resetStoreInfo + getters）** 明确不动——阶段 3 范围，gated by compiler/* 迁移。

---

## 附录：关键文件与行号

| 文件 | 行 | 内容 |
|---|---|---|
| `src/packer/store/env.ts` | L20 | `let defaultCompilerContext`（singleton，永不 reset） |
| `src/packer/store/env.ts` | L179 | `storeInfo` 函数（双角色） |
| `src/packer/store/env.ts` | L209-219 | compat 写（load-bearing 副作用） |
| `src/packer/store/env.ts` | L229 | `resetStoreInfo`（worker 桥接） |
| `src/packer/store/env.ts` | L256/279 | `toPackerContext`/`buildPackerContext`（PackerContext 构造） |
| `src/packer/store/env.ts` | L297+ | ~20 getters（ALS 门面） |
| `src/packer/store/project-store.ts` | L51 | `store.load → storeInfo`（唯一调用方） |
| `src/packer/store/config-collector.ts` | L37 | `sctx.storeInfo = store.load(...)`（触发点） |
| `src/packer/types.ts` | PackerContext interface（I/O 能力 shape） |
| `src/packer/types.ts` | Graph interface L347+（D-NS-1 accessors） |
| `src/packer/orchestrator.ts` | L118 | `orchestrate(ctx, state, options)`（北星签名） |
| collaborator 读 sctx.storeInfo | config-compiler-collab L29 / npm-builder L294 / stage-dispatcher L85 / publisher L33 |
| main-thread getter 消费方 | publish.ts L22 createDist / project-store L57 getDependencyGraph / publish.ts L107-109 fallback / npm-builder L28 fallback |
