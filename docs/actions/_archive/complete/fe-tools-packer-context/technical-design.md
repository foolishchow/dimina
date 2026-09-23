# Technical Design — fe-tools-packer-context

Status: **draft（2026-09-22）** — D-PC-0..11 已冻。

权威参考：[Experience-Review.md](../../../../Experience-Review.md) · [packer types §2](../../../../../fe/tools/bundler/src/packer/types.ts) · [graph-bootstrap](../fe-tools-graph-bootstrap/README.md) · [packer-orchestrator](../fe-tools-packer-orchestrator/README.md)

## §0 现状

```text
storeInfo / orch
  → PackerGraph.build(ctx)
       void ctx
       → storeProjectConfig / storeAppConfig / storePageConfig / createInitialDependencyGraph
       → 经 ALS Proxy 读写 CompilerContext

toPackerContext(CompilerContext):
  readContent = fs.readFileSync
  resolveAlias / resolveNpm = stub
```

路 1：ctx 形同虚设；`graph → env store*` 环依赖。

## §1 目标接线（路 2）

```text
storeInfo steps 1–2（paths + fileTypes → ALS；storePathInfo 可仍 init ALS npmResolver）
  → ctx = toPackerContext(…)（D-PC-5；可抽 packer/context.ts）
  → PackerGraph.build(ctx) / reconcile(ctx)
       内容：ctx.readContent
       存在性：fs.existsSync（D-PC-7；不进 PackerContext）
       paths / fileTypes：ctx.workPath / ctx.targetPath / ctx.fileTypes（D-PC-10）
       npm：new NpmResolver(ctx.workPath)（D-PC-8）
       alias：读正在填充的局部 configData.appInfo（非 PackerContext.resolveAlias）
       全过程只用 Graph 局部 state（D-PC-9）；禁止 ALS getter 回环
       写入 this.configData / this.graph
  → 回写 ALS context.graph / configInfo / dependencyGraph（兼容 getter；build 结束后）
```

不再：`void ctx` + 委托 env `store*Config` 主路径（D-PC-6）。

**迁移范围**：config fixpoint 全体函数随 `store*Config` 一并迁入 Graph 私有模块——含递归 `storeComponentConfig`（读 `usingComponents` → 解析路径 → 读 component.json → 递归）、`collectionPageJson`（遍历 pages + subPackages 读 page.json）、`storeCustomTabBarConfig`、`detectRuntimeType`（game.json vs app.json 判定）、`parseContentByPath`（JSON 读取）、`getModuleId` + `resolveAppAlias`（组件路径解析）。

## §2 与形状的关系

| 形状 / 前决策 | 本门 |
| --- | --- |
| D-PCS-1 PackerContext = I/O | **落地可用**（paths/readContent/fileTypes）；resolvers stub（D-PC-4）；不扩 exists（D-PC-7） |
| D-PCS-4 Graph 自举 | **路 2** |
| D-PCS-6 不含 graph/cache | 保持 |
| D-GB-1 路 1 | **关闭**（D-PC-6） |
| D-OR-* | 不重开 |

## §3 落点

| 组件 | 变更方向 |
| --- | --- |
| `packer/types.ts` | 注释对齐 D-PC-4 stub / D-PC-7 不扩 exists |
| `toPackerContext` / 可选 `packer/context.ts` | 装配权威（D-PC-5）；resolvers stub + 注释 |
| `packer/graph.ts`（± 私有模块） | 迁入 config fixpoint；消费 ctx；D-PC-7..10 |
| `compiler/core/env.ts` | `storeInfo` 仍调 factory→graph；`store*Config` → 薄壳（D-PC-11）；破 `graph→env store*` 环 |
| `packer/orchestrator.ts` | **不改**装配/写权（D-PC-2） |
| `packer/README.md` | **close 时**回流映射（F6）；本门实施可不先改 |

## §4 Resolvers（D-PC-4）

- PackerContext 字段保留，实现 stub
- config fixpoint 不读这两字段；路径解析用 Graph 内迁自 `resolveAppAlias` / `NpmResolver.resolveComponentPath`（D-PC-8）
- **`resolveAppAlias` 有外部调用者**（`logic/parse-walk.ts` line 312，源级 alias 解析）；env.ts 版本保留为薄壳（读取 ALS `configInfo.appInfo`），Graph 私有版本读取 `this.configData.appInfo`。`getModuleId` 无外部调用者，可完全迁入 Graph 私有
- 真接线：另门

## §5 存在性与 fileTypes（D-PC-7 / D-PC-10）

- `readContent`：JSON/源内容唯一入口（相对今日 `getContentByPath`）
- `existsSync`：留在 Graph（或私有模块）实现层，**不**提升为 PackerContext 契约
- `getFileDependencyKind` / `addExistingModuleFiles`：扩展名列表取自 `ctx.fileTypes`，不调 `getTemplateExts()` 等

## §6 NpmResolver 与 build 局部性（D-PC-8 / D-PC-9）

- build 开头（或首次需要时）`const npm = new NpmResolver(ctx.workPath)`，传入私有 `getModuleId`
- `runtimeType` / `appInfo` / `pageInfo` 写在 `this.configData`（或 build 临时对象），`isMiniGame` 等价判断读局部字段
- **禁止**：build 中调用 `isMiniGame()` / `getRuntimeType()` / `getAppConfigInfo()` / `getWorkPath()` 等依赖 ALS/未回写 graph 的 getter
- build **结束后** `storeInfo` 回写 ALS（今日已有）；getter 对外行为不变

## §7 env config 薄壳（D-PC-6 / D-PC-11）

- 逻辑体在 Graph / 私有模块
- env 保留 `storeProjectConfig` 等 export 为薄委托（供 `env.spec.js`），**主路径** `graph.build` 不再调用「经 ALS Proxy 的旧实现」
- 关闭时：证明 Graph 主路径无 `void ctx`；薄壳非第二套 fixpoint

## §8 行为 0

- 不改三车道产物字符串语义
- 验证：examples diff（全量 7 项目：air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui——Experience-Review §12）+ vitest + tsc
