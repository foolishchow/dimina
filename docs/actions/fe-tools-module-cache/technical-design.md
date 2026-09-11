# Technical Design — fe-tools-module-cache

> 状态：**草案（2026-09-10）**。基于 source-audit 的代码事实；D-MC-1..3 待 ready 冻结。vivid source 待探针（§5）。

## 1. 两层缓存形状（R-MC1）

```js
// worker 内
ModuleCache
  key   = schemaVersion + contentHash(文件内容) + compileFingerprint(维度见 §3)
  value = { contentHash, result | { failed, errorShape }, kind }
  // 纯函数、内容寻址；失败也缓存（R-MC3）

EntryCache（派生层）
  key   = entryId 组合维度（页面模板组合 + module 集合 hash）
  value = 组合产物（render code / css）
  // 依赖 module 变化 → entry 失效（build-model 侧消费；本 Action 只定义边界与寻址）
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
