# Technical Design — fe-tools-packer-research

Status: **in_progress（2026-09-20）** — 15 轮 review 收敛，23 findings 全修正

## 1. 研究方法

逐焊点做方法级分析，产出：
- Packer / Scheme / 共用 / 不可分 的方法标注
- 外部依赖耦合度
- 可抽提性评估（容易 / 需接口设计 / 极难 / 不值得）
- 提取序列建议

详见 [source-audit §7 分析结果](source-audit.md#7-分析结果pr01-04-深度审计)。

## 2. 研究发现

### W1 emit.ts — 需接口设计

- `EmitModule` / `ModuleCollection` / `EmitEntryParams` 已不感知小程序/页面/WXML
- `modDefine` 可参数化为 `wrapModule(moduleId, code) => string`；行为 0 可守（同字符串 → 同字节）
- `getWorkPath()` 可参数化为 `sourceRoot: string`
- `kind: 'view' | 'logic'` 保留但改为参数注入（BuildModel 键 + dev server 路由依赖）
- **可抽提性**：需接口设计（~20 行改动，低风险）

### W2 logic/index.ts — 需接口设计 + 大量重构

- Packer 胚（AST parse + walk + transform + sourcemap）是完整的模块编译管线
- 11 种 env.ts 调用可收敛为 4 个 hooks（graphWriter / pathProvider / resolver / stateRestore）
  - graphWriter：addFile + addDependency + getDirectDependencies（读+写）
  - pathProvider：sourceRoot + outputRoot（标量）
  - resolver：content + npm + alias + component + appConfig（五合一，粒度较粗）
  - stateRestore：resetStoreInfo + appId + isMiniGame（标量 + 状态）
- **可抽提性**：需接口设计 + 大量重构（633 行混合逻辑，中风险）

### W3 env.ts — 不拆（注入 context）

- 26 exports，分类后 2 Packer / 9 共用 / 14 Scheme / 1 基礎设施 / 3 未使用
- env.ts 本质是 Scheme 的 context bus（ALS + Proxy 代理）
- storeInfo 是纯 Scheme 初始化（Packer 不调）
- 图初始化（L814-899）是纯 Scheme 填工程图
- **可抽提性**：极难 / 不拆。改为注入 PackerContext（4 hooks），Packer 胚通过 context 访问 9 个共用函数

### W4 dependency-graph.ts — 不拆（限定 kind API）

- API 已泛化（type / kind 都是 string）
- getAffectedEntries 跨两侧遍历（file → owner → BFS dependents → entry）—— 本质耦合
- 拆成两图需跨图索引，复杂度高
- **可抽提性**：不拆。保持一份实例，Packer 通过限定 kind='logic' 的 API 间接使用。方案 B（零行为风险）

## 3. Packer API 草案

```typescript
interface PackerContext {
  sourceRoot: string
  outputRoot: string
  moduleIdPrefix: string
  runtimeType: 'miniProgram' | 'miniGame'

  graphWriter: {
    addModuleFile(moduleId: string, filePath: string): void
    addModuleDependency(from: string, to: string): void
    getComponentDependencies(moduleId: string): string[]
  }

  resolver: {
    content(path: string): string
    npm: NpmResolver
    alias(specifier: string): string | null
    component(path: string): unknown
    appConfig(): { subPackages: Array<{ root: string }> }
  }

  stateRestore(state: unknown): void
}

interface Packer {
  compileModule(filePath: string, context: PackerContext): Promise<CompiledModule>
}

interface CompiledModule {
  moduleId: string
  code: string
  map: string | null
  extraInfoCode?: string
}
```

4 hooks ≤ 5 ✓。resolver 粒度较粗（5 函数合一），需验证语义不冲突。

验证问题解答：
- graphWriter 需要读能力（getDirectDependencies('component')）✓ — 已含 getComponentDependencies
- componentResolver 语义：logic 用 getComponent 获取组件配置（path → component module）✓
- stateManager（resetStoreInfo）：仅 logicCompile 入口调 1 次，恢复 ALS 状态 ✓
- appConfig 语义：logic 用 getAppConfigInfo().subPackages 做分包组件过滤 ✓
- runtimeType 语义：logic 用 isMiniGame() 判断是否小游戏（影响入口逻辑）✓

## 4. 提取序列建议

| 序号 | 焊点 | 工作量 | 依赖 | 风险 |
| --- | --- | --- | --- | --- |
| 1 | W1 emit | S (~20 行) | 无 | 低（wrapModule 参数化，行为 0 可守） |
| 2 | W4 graph | 不拆 | — | 零（方案 B：限定 kind API） |
| 3 | W2 logic | L (633 行) | W1 + W4 | 中（11 hooks 抽取，4 hooks 注入） |
| 4 | W3 env | 不拆 | — | 零（注入 PackerContext，env.ts 不改） |

## 5. 决策建议：不值得立即做

**结论**：Packer extraction 当前不值得立即实施。

**证据**：
1. **ROI 不足**：W2 需 L 级工作量（633 行重构 + 4 hooks 设计），但 Packer 胚与 Scheme 深度交织，提取后仍需 4 个 Scheme hooks——Packer 无法独立运行
2. **当前架构可接受**：4 焊点耦合度经 15 轮 review 审计，数据完整（26 exports / 11 函数 / 26 调用），无阻塞性技术债
3. **更高优先级**：TODO 候选 C 刀 2（失效查询）+ 刀 3（ModuleCache）直接改善 dev 性能，应优先
4. **延迟条件**：ModuleCache 落地后，Packer 边界自然清晰，届时重评估

**推荐路径**：
- 先推进 TODO 刀 2 + 刀 3（直接 dev 性能收益）
- PackerContext 草案回流 architecture-notes，供长期参考
- W1（emit.ts parameterize）可作为独立小 Action 先行（S 级，低风险，高价值）
- W2/W3/W4 维持现状

## 6. 待验证项

见 [source-audit §7 分析结果](source-audit.md#7-分析结果pr01-04-深度审计)（已全部填充）。

## 7. 风险清单

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 行为 0 风险（W2 logic） | 633 行重构可能改变产出字节 | 全量 vitest + 4 组 diff=0；modDefine wrapModule 返回相同字符串可守 |
| 测试覆盖风险 | 588+ 测试覆盖 compile 模式；dev 模式 dev-server.spec.js 覆盖；但 hooks 注入路径无直接测试 | 新增 PackerContext 单测；消融验证（拔 hook → crash） |
| 回归风险（W3 env.ts 若拆） | env.ts 15 文件扇入，拆分可能破坏所有车道 | 方案 B 不拆 env.ts → 零回归风险 |
| resolver hook 粒度过粗 | 5 函数合一可能语义冲突（content/npm/alias/component/appConfig） | 研究阶段标注，实施时拆分验证 |
| getAffectedEntries 跨图（W4 若拆） | 拆图后跨图遍历可能遗漏失效 | 方案 B 不拆图 → 零风险 |
