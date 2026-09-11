# Technical Design — fe-tools-module-cache

> 状态：**草案（2026-09-10）**。基于 source-audit 的代码事实；D-MC-1..3 待 ready 冻结。vivid source 待探针（§5）。

## 1. 三模块模型（GroupModule / ViewFileModule / LogicFileModule）

### 粒度与归属（2026-09-10 讨论收敛）

```text
GroupModule（主线程权威，跨 build）
  id = owner（页面/组件/npm 包）
  kind = 'page' | 'component' | 'npm'
  viewFiles / logicFiles / styleFiles / configFiles  ← 跨维度输入引用

ViewFileModule（worker，单 stage）
  file: 单 wxml 相对路径
  parseResult: DOM / 组合中间结果（内容寻址缓存）
  groups: [{ groupId, groupKind: 'page'|'component'|'npm' }]  ← 所属 Group 引用（注入）

LogicFileModule（worker，单 stage；缓存价值单独评估，见 D-MC-5）
  file: 单 js 相对路径
  ast / moduleResult: oxc AST / 模块中间结果
  groups: [{ groupId, groupKind }]  ← 同样携带 Group 关联
```

### 关键：Group 关联必须存在于 FileModule 域内（2026-09-10 用户确认）

```text
原因：
  1. view 编译语义取决于 Group 类型：Page（多根/page.json）、Component（组件边界）、
     npm（包组件路径解析）——ViewFileModule 必须知道自己在哪种 Group 语境下被处理
  2. 失效传播需要双向关联：文件变 → 所属 Group 集合 → 精确到维度的失效

原则：
  Group 关联的权威在主线程 GroupModule（避免双写）；
  FileModule 内的 groups 是注入的引用（主线程任务输入时带上，不在 worker 内重新发现）

失效链（跨维度精确）：
  wxml 变 → ViewFileModule miss → 所属 Group 集合 → 这些 Group 的 view 维度失效
  js 变   → LogicFileModule miss → 所属 Group 集合 → 这些 Group 的 logic 维度失效
  json 变 → Group 配置（usingComponents）变 → 关联 Group 的配置失效
```

### 两端依赖图不同（不可共用）

```text
GroupModule 层：owner → owner（组件树 usingComponents 边）——主线程公共
view 域内：    ViewFileModule → ViewFileModule（include/import/template 模板域边）
logic 域内：   LogicFileModule → LogicFileModule（import/require 模块域边）
```

Group 层依赖图可共享；file 层依赖图按域异构，不可统一。

### 与 templateRenderCache 的关系

```text
ViewFileModule（wxml → DOM）         ← 新增（组合前）
templateRenderCache（tpl → render）  ← 保留（组合后，entry 级）
```

## 2. 现状缓存归宿（D-MC-1 形态①）

| 现状 | 归宿 |
| --- | --- |
| `optionalChainingCache` | ModuleCache（本就是内容寻址） |
| `templateRenderCache` | 拆解：tpl 内容签名 → ModuleCache 的 module 结果层；组合结果 → EntryCache（探针定精确切点） |
| `compileResCache` | 升级内容寻址（R-MC2）或明确单 build（D-MC-3） |
| `processedModules`（logic） | 保持"已处理标记"，不承担结果缓存（R-MC1 注释） |
| `wxsFilePathMap` | 路径绑定，不迁移（Non-goal） |

## 3. key 维度协议（R-MC4，跨 build 安全前提）

```text
moduleKey = H(
  'mc-v1',
  modulePathRelative,
  contentHash(文件内容),
  compileFingerprint,
)
compileFingerprint = H(
  minify,              // view 产物压缩
  esTarget.view,       // esbuild transform target
  fileTypes,           // 模板扩展名
  renderer,            // A4；当前 webview
)
```

- 路径使用**项目相对 POSIX 路径**（进 key；机器绝对路径/临时路径不进）
- 与 build-model 的 inputHash 协议对齐方式（Readiness gap 3）：`compileFingerprint` 即其 `contextHash` 的 worker 侧表达

## 4. 失败缓存（R-MC3）

```js
value = { failed: true, errorShape }
// errorShape 为可序列化错误（name/message/关键字段），诊断通道保留原错误对象重建路径
// 缓存命中时：重新 emit 等价错误（不再执行失败代码路径）
```

## 5. 待探针（ready 前）

1. view"组合型编译"的 module 切点：templateRenderCache 现有 key（path+源签名+wxs签名+tpl）拆解为 module 层/entry 层的精确边界（source-audit §3 的结构约束内）
2. compileResCache 内容寻址化成本测算（D-MC-3 二选一依据）
3. 颗粒度断言的可观察判据（"单文件只 parse 一次"如何在不侵入编译流程的前提下观察——探针计数/日志/覆盖率探针）

## 6. 风险

| 风险 | 缓解 |
| --- | --- |
| 拆解 templateRenderCache 引入等价回归 | 字节级 diff 双模式验收（MC1） |
| key 维度漏项 → 跨 build 错误命中 | R-MC4 维度清单 + MC2 单测（配置切换不命中旧 key） |
| 失败缓存掩盖 transient 错误 | 失败缓存与诊断通道分离；错误形状可重建 |
| 组合闭包依赖图不当 → 组合前缓存 miss 或错误命中 | 组合闭包从 `getDependencyGraph().fileOwners` 反查（module-cache 不改组合算法，只在组合前查缓存；miss 走现有组合现场） |

**纠偏（2026-09-10 讨论）**：早期认为 module 层难在“触碰 view 组合逻辑结构”——不成立。现状 ModuleGraph（DependencyGraph）已存文件归属（`fileOwners`），一页面的 include/template/wxs 输入集可反查；“组合前内容缓存”只需在现有组合算法**前**垫一层查询（单文件 hash + miss 才走现场），**组合算法本身不拆不改**（D-MC-4）。真正的改动是：补齐内容层（文件 → 组合中间结果），不拆 view 结构。
