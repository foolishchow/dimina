# Source Audit — fe-tools-build-model

Status: `draft`（2026-09-10，基于 HEAD `8438306a` 的代码事实）

本文件沉淀起草前的三轮现状侦察证据（直通式数据流 / 缓存清单 / 双 plan 实现 / 产物粒度）。所有断言均有代码位置佐证；TS-2 素材（AST 矩阵）附于文末。

## 1. 直通式数据流（无构建内模型）

```text
view worker:   读源 → cheerio → 拼Vue模板 → compileTemplate → 直接写盘
logic worker:  oxc AST → MagicString → esbuild → fs.writeFileSync('logic.js')   (:125/:142)
style worker:  postcss → 直接写盘 (:110)
                 ↓ 全部写入 targetPath（构建目录）
publishToDist: 整目录 rename/move 到发布目录（临时目录 O(1) rename，publish.js:56）
                 ↓
runBuild 返回: 仅 appInfo + dependencyGraph（元数据）—— 产物不在返回值
```

**证据**：
- worker `postMessage` 只回 `{compatibilityWarnings, dependencyGraph, completedTasks}`（view-compiler.js:265）——**产物不回主线程**
- `createDist(seedPath)`（publish.js:21）：构建目录级 staging；"上一次构建"以**文件**形式存在于 seedPath，不在内存
- runBuild 返回值（index.js:240-252）：`result` 不含任何产物内容

**结论**：load/transform/output 三步在阶段函数调用栈内时序耦合（读→算→写一气呵成）。

## 2. 现有缓存清单（全部是叶子备忘录，非模型）

| 缓存 | 位置 | 性质 |
| --- | --- | --- |
| `templateRenderCache` | view worker（Map） | key = `path+源签名+wxs签名+tpl` 四段——**输入指纹→产物的备忘录**（本 Action 机制的雏形） |
| `compileResCache` | view worker（Map） | 模板编译结果（module path 键） |
| `optionalChainingCache` / `wxsFilePathMap` | view worker | 微缓存 |
| `compileRes` | style worker（Map） | css 结果 |
| `processedModules` | logic worker（Set） | 已处理模块 |
| `DependencyGraph` | 主线程（跨 build） | **唯一结构持有**：nodes/edges/fileOwners/kinds——有结构无内容（不持 IR/产物） |

## 3. 两套增量计划生产者（形状不同、逻辑重复）

| | `watch-plan.js` `createWatchBuildPlan` | `compile-cache.js` `createCachedAppBuildPlan` |
| --- | --- | --- |
| 触发 | 文件事件（内存） | 指纹对比（落盘 `compile-cache.json`） |
| 受影响 | `graph.getAffectedEntries(filePath)` | 同一方法（changed 集合） |
| stages | `getCompileStagesForFiles` | 同一函数 |
| 保守退回 | count>1 / 非change / `.json` / 未知kind → 全量 | 结构变 / 非change / `.json` / 未知kind → 全量（**重复维护**） |
| 输出形状 | `{skip, incremental, options}` | `{mode:'full'|'skip'|…, reason, options}`（**形状不同**） |
| 编译器自检 | ❌ 无 | `compilerLastModified`（mtime）仅此路径有 |

消费者按各自理解拆 options：one-shot（无参全量）/ watch rebuild（`{...options, ...plan.options}`）/ cache 批编译（`plan.options`）；dev-reload 还依赖 watch plan 的私有形状（dev-reload.js:7 注释写死）。

**关键行为锚点**：`watch-plan.spec` 锁定 count>1（事件合并）→ 保守全量——本 Action M2 将**有意改变**此行为（指纹对比无合并问题），须更新对应测试并记录为行为改进。

## 4. 产物粒度表（决定本 Action 增量粒度的诚实边界）

| compiler | 产物边界 | 现增量粒度 | 本 Action 粒度 |
| --- | --- | --- | --- |
| view | 每 page/component 一个 render.js | stage + affectedEntries（页列表） | **entry(page) 级**（输入=该页 wxml+include链+wxs 集的指纹聚合） |
| style | 每 page 一个 css + app.css | 同上 | entry(page) 级 + app 级 |
| logic | **整个 app 单文件 logic.js** | stage 级（实质全量 bundle） | **app 级特例**（esbuild 全量，保持现状粒度，不假装 module 级） |

## 5. 上下文与 worker 边界（本 Action 不动的部分）

- 主线程：`runWithCompilerContext`（ALS，每 build 新建 `{pathInfo, configInfo, npmResolver, dependencyGraph, compilerOptions}`）；`pathInfo/configInfo` 为 Proxy 路由
- worker：`postMessage` 携带全量上下文 + `resetStoreInfo` 重建（协议特化：`{pages, storeInfo, sourcemap, compileConfig}`）
- rebuild 时 storeInfo 阶段**每次全量重跑**（无 skip 条件）——已知 L0 热点，本 Action 不解决（属调度/facade 后续）

## 附：TS-2 素材（AST 现状矩阵，供后续 IR Action 引用）

| 环节 | 中间表示 |
| --- | --- |
| view·模板链 | ❌ 无自有 AST/IR（cheerio DOM + Vue template 字符串直通 + 正则插值）；view·js 链有 oxc AST |
| logic | oxc AST + MagicString（"AST 指导的源码变换"，不重新生成） |
| style | postcss CSS AST + selector-parser（**已是 pass 化雏形**：postcss plugin 模型可作 facade 参照） |
| config | JSON（天然结构化） |

三层判定升级缝：`source hash`（本 Action）→ `IR hash`（TS-2 后）→ `output hash`（更远）。
