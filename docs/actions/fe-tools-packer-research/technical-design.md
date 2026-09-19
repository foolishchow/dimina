# Technical Design — fe-tools-packer-research

Status: **draft（2026-09-20）** — 研究阶段，待填充

## 1. 研究方法

逐焊点做方法级分析，产出：
- Packer / Scheme / 共用 / 不可分 的方法标注
- 外部依赖耦合度
- 可抽提性评估（容易 / 需接口设计 / 极难 / 不值得）
- 提取序列建议

## 2. 初步观察（待验证）

### W1 emit.ts — 接口已泛化，modDefine 是关键问题

- `EmitModule` / `ModuleCollection` / `EmitEntryParams` 已不感知小程序/页面/WXML
- `modDefine` 包裹格式出现在 3 处，是唯一 Dimina 专有元素
- **假设**：`modDefine` 可参数化为「输出格式器」（`wrapModule(moduleId, code) => string`），emit.ts 即可成为 Packer 产出层
- `getWorkPath()` 依赖（perModule rebase）可参数化为 `sourceRoot` 参数
- **可抽提性预估**：需接口设计（parameterize modDefine + getWorkPath）

### W2 logic/index.ts — Packer 胚与 Scheme 深度交织

- Packer 胚（AST parse + walk + transform + sourcemap）是完整的模块编译管线
- 11 种 env.ts 调用混入（graph ×8 [getDependencyGraph]、path ×11 [getWorkPath 8+getTargetPath 2+resolveAppAlias 1]、config ×4 [getComponent+getAppConfigInfo+getContentByPath+getNpmResolver 各 1]、state ×2 [resetStoreInfo]、identity ×1 [getAppId]、runtime ×1 [isMiniGame]）= 27 调用
- **假设**：Scheme 调用可抽成 Packer 的 hooks（graphWriter / pathResolver / componentResolver / npmResolver / stateManager），但需要大量接口设计
- **可抽提性预估**：需接口设计 + 大量重构（633 行混合逻辑）

### W3 env.ts — 最硬焊点，可能不值得拆

- 26 exports，分类后 2 Packer / 9 共用 / 14 Scheme / 1 基础设施 / 3 未使用
- `runWithCompilerContext`（AsyncLocalStorage）是两侧共用基础设施
- `getDependencyGraph` / `getWorkPath` / `getTargetPath` / `getAppId` / `getContentByPath` / `getComponent` / `isMiniGame` 被 Packer 胚和 Scheme 编排同时调用（`storeInfo` 实际仅 project-store 调，归 Scheme 侧）
- **假设**：env.ts 本质是 Scheme 的 context bus，Packer 胚通过它读 Scheme 状态。拆成 PackerContext + SchemeContext 需要重新设计 9 个共用函数的归属。可能不值得拆——可以保持 env.ts 为 Scheme 基础设施，Packer 通过注入的 context 对象访问需要的 2+9=11 个函数
- **可抽提性预估**：极难（或：不拆，改为注入 context）

### W4 dependency-graph.ts — 一图两职，可拆但需跨图索引

- API 已泛化（`type` / `kind` 都是 string）
- Scheme 填 app/pages/components + file kinds（config/view/style）；Packer 填 module nodes + logic edges
- `getAffectedEntries` 跨两侧遍历（file → owner → BFS dependents → entries）
- **假设**：可拆成 ProjectGraph + ModuleGraph，但 `getAffectedEntries` 需要跨图遍历——要么保留一份实例，要么建立跨图索引
- **可抽提性预估**：需接口设计（跨图遍历方案）

## 3. Packer API 草案（待填充）

```typescript
// 草案方向，非最终 API

interface PackerContext {
  sourceRoot: string          // 替代 getWorkPath()
  outputRoot: string         // 替代 getTargetPath()
  moduleIdPrefix: string     // 替代 getAppId()
  graphWriter: GraphWriter   // 替代 getDependencyGraph().addFile/addDependency
  npmResolver: NpmResolver   // 替代 getNpmResolver()
  aliasResolver: (path: string) => string  // 替代 resolveAppAlias()
  contentResolver: (path: string) => string  // 替代 getContentByPath()
  // ...
}

interface Packer {
  compileModule(filePath: string, context: PackerContext): Promise<CompiledModule>
  // compileModule 内部: parse → walk → resolve → rewrite → transform → sourcemap
}

interface CompiledModule {
  moduleId: string
  code: string
  map: string | null
  extraInfoCode?: string
}
```

以上仅为方向性草案。research 阶段需验证：
- hooks 粒度是否足够（11 种 Scheme 调用）
- `graphWriter` 是否需要读能力（`getDirectDependencies`）还是只写
- `componentResolver` 语义（logic 用 `getComponent` 做什么）
- `stateManager`（storeInfo / resetStoreInfo）是否 Packer 侧需要

## 4. 提取序列草案（待验证）

假设全部值得提取（待 research 验证）：

| 序号 | 焊点 | 依赖 | 风险 |
| --- | --- | --- | --- |
| 1 | W4 dependency-graph | 无 | 拆成 ProjectGraph + ModuleGraph + 跨图索引 |
| 2 | W1 emit | 无 | parameterize modDefine + getWorkPath |
| 3 | W2 logic | 依赖 W1（emit）+ W4（graph） | 11 种 hooks 抽取 |
| 4 | W3 env | 依赖 W2 抽取后的 PackerContext 形状 | 最硬，可能不拆 |

## 5. 替代方案：不提取

如果 research 结论是「不值得」：
- 保持 D-BD-1..6 落点表不变
- 4 焊点维持现状
- 文档回流：「Packer extraction 评估完成，结论不值得——4 焊点耦合度可接受，提取投入产出比不划算」
- 关闭 TODO 候选 B/C（emit 抽取已完成；失效查询 + ModuleCache 独立推进）

## 6. 待验证项

见 [source-audit §7](source-audit.md#7-待分析项research-阶段填充权威全集)（权威全集）。

## 7. 风险清单（待填充）

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 行为 0 风险 | （待 research 填充） | |
| 测试覆盖风险 | | |
| 回归风险 | | |
