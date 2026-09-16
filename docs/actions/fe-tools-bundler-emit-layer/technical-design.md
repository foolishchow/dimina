# Technical Design — fe-tools-bundler-emit-layer

Status: **draft（R9 review 中 · 2026-09-15）** — R1-R7 收敛后清理；主线 + 决策表 + 签名。

## 1. 现状锚定（实证）

| 引擎 | 产物 | 写盘点 | transform | 模块概念 |
| --- | --- | --- | --- | --- |
| view | pages_X.js（每页） | mkdir + write × 4 | **整包一次** + moduleRanges 行定位 | scriptRes Map（render 模块） |
| logic | logic.js（每包） | mkdir + write × 3 | **逐模块**（minify 时） | compileRes 数组 |
| style | pages_X.css + map（每页） | mkdir + write × 2 | 无（CSS 编译在 buildCompileCss 内完成） | 无（单文件产物） |

共同问题：各自 `mkdirSync` + `collectOutput ? postMessage : fs.writeFileSync` 样板 ~100+ 行；build-model materialize 声称"唯一写盘出口"但直写路径未收敛（9 处）。

## 2. 目标形状

```text
src/compiler/{view,logic}/index.js（编译）
  └─ 产出「模块集合」iterable<{moduleId, code, map}>（提供者 A0 = scriptRes/compileRes）
        └─ pipeline/emit.js  emitEntry(本质参数, outputEnv)  // 签名见 §7
             ├─ transform 策略注入（bundle / perModule —— 各自 apply + 错误定位）
             └─ 内部调 → pipeline/output.js  write({entry, collectOutput, writeDir})
                    └─ collectOutput ? postMessage(M1) : mkdir + writeFileSync
src/compiler/style/index.js
  └─ → pipeline/output.js  write({entry, collectOutput, writeDir})   // 不经 emitEntry
```

## 3. 模块集合契约

```js
/**
 * @typedef {{ moduleId: string, code: string, map: string | null }} EmitModule
 * @typedef {Iterable<EmitModule>} ModuleCollection
 */
```

- **不含 range/sourceFile**——错误定位（moduleRanges）是 bundle 策略拼接时私有生成（随布局变，不进模块属性）。
- **map 自包含 source**——logic 的 `sourceFile` 最终进 `generatedMap.sources`，rebase 从 `module.map.sources` 取，故 contract 不需 sourceFile 字段。
- 提供者：现在 scriptRes（Map）/ compileRes（Array）；未来 ModuleCache（刀 3）以同形状提供。

## 4. transform 策略

```js
const strategies = {
  bundle: {
    async apply(ctx, cfg) {
      // 整包拼接：modDefine 包裹 + moduleRanges 行映射（错误定位）
      // minify / target / platform 经 esbuild transform(bundleSource, {…})
    },
  },
  perModule: {
    async apply(ctx, cfg) {
      // 逐模块：每个 modDefine 单独 transform，天然错误定位（失败即该模块）
      // sourcemap rebase 在此步——rebase module.map.sources
      //   （绝对路径 → relative(finalOutputDir, resolve(workPath, sourcePath))）
    },
  },
}
```

- 策略**函数注入**（非标志位 if）——bundle/perModule 各自实现 apply + 错误定位。
- **CF-1 约束**：`effectiveJsMinify = minify && !sourcemap`——sourcemap 模式跳过 minify（mergeSourcemap 只做单层行偏移，串联两份 map 未实现）。

### 4.1 交叉矩阵（实施必读）

| 策略 | sourcemap | minify | 产物路径 |
| --- | --- | --- | --- |
| **bundle**（view） | ✓ | ✗（CF-1） | mergeSourcemap → bundleCode+map → `//# sourceMappingURL=` 拼接 |
| **bundle**（view） | ✗ | ✓ | 整包 transform(minify:true, target:view, platform:browser) |
| **bundle**（view） | ✗ | ✗ | 整包 transform(minify:false, target:view, platform:browser) |
| **perModule**（logic） | ✓ | ✗（CF-1） | rebase map.sources → mergeSourcemap → `//# sourceMappingURL=` 拼接 |
| **perModule**（logic） | ✗ | ✓ | 逐模块 transform(minify:true, target:logic, platform:neutral) → 拼接 |
| **perModule**（logic） | ✗ | ✗ | 直接 modDefine 拼接（无 transform） |
| **style**（不经 emitEntry） | ✓ | — | compileSS 内 `/*# sourceMappingURL= */` 拼接 → output.write |
| **style** | ✗ | — | compileSS → output.write(css) |

- **view sourcemap 路径**：`mergeSourcemap(compileRes, filename)` 吃的 compileRes 是**临时拼装**（`[...scriptRes.entries()].map(...)` + `sourceMapRes.get(path)`），不是 scriptRes 本身。logic 的 compileRes 是编译时累积的数组，直接可用。
- **map 类型**：三引擎最终 postMessage/writeFileSync 的 map 都是 **string**（view/logic = `smg.toString()`；style = `JSON.stringify(map)`，转换在 compileSS 内部）。
- **style minify**：CSS minify 在 buildCompileCss 内部（cssnano/autoprefixer），不经 emit/output——矩阵 minify 列标"—"。
- **style sourcemap 来源**：style 用 `options.sourcemap`（函数参数）；view/logic 用全局/模块导出 `enableSourcemap`。output.write 参数需显式传 sourcemap flag（不从全局读）。

### 4.2 modDefine 包裹格式（行为 0 风险）

- sourcemap 路径用 `wrapModDefine`（无额外 tab 缩进）；非 sourcemap 路径手写模板字面量（**3 层 tab 缩进**）。
- 非 sourcemap 经 esbuild transform → tab 被吃 → 产物无 tab；sourcemap 不经 esbuild → 无 tab 直接进产物。
- **统一用 wrapModDefine 后**：非 sourcemap + 非 minify 路径（esbuild minify:false）的 tab 消失——若 esbuild 保留 tab，产物 diff。**validation P-E04b 对拍必须覆盖此路径**。

## 5. output

```js
// pipeline/output.js —— 唯一写盘出口（materialize 名不副实修复）
write({ entry, collectOutput, writeDir })
// entry = { entryId, kind, files: [{path, code}], sourcemaps?: [{path, map}] }
// 与 BuildModel.add 入参完全一致（三引擎实证一致，不引入新形状）
```

- **collectOutput 路径**：postMessage({ type:'output', entry })；
- **直写路径**：mkdir -p（收口三引擎各自 mkdirSync）+ writeFileSync；
- **不管 count**（count 在 emitEntry 层返回）；**不管 rebase**（rebase 在策略 apply 内）。
- **path 组合**：`writeDir` = 绝对写盘目录（`getTargetPath()/main` 或 `/root`）；`entry.files[].path` = 相对发布根的物化路径（含 `relPrefix`，如 `main/pages_X.js`）；直写 = `path.join(writeDir, path.basename(entry.files[].path))`；postMessage = `entry.files[].path` 原样。
- **sourceMappingURL**：view/logic 的 `//# sourceMappingURL=` 在 **emitEntry** 拼接；style 的 `/*# sourceMappingURL= */` 在 **compileSS 内部**拼接（不经 emit）。output.write 收到的是已含拼接的 code。
- **style 只调 write**（D-E-8），不经 emitEntry。

## 6. 行为 0

- 三引擎传原参数组合 → 产物字节不变（moduleRanges 原样迁入 bundle 策略；逐模块 transform 原样迁入 perModule 策略）。
- 验收 = 三链对拍 diff=0（含非 sourcemap + 非 minify 路径，P-E04b）+ vitest 全量。

## 7. 签名（最终）

```js
// emitEntry —— 方案 A：内部调 output.write，返回 number
emitEntry({
  entryId, kind,
  modules,                    // Iterable<{moduleId, code, map}>
  transform: { strategy, minify, target, platform },
  sourcemap,                  // boolean
  sourcemapTargetPath,        // string | null（perModule rebase 基准，仅 logic）
  filename, relPrefix,
}, outputEnv)                 // { collectOutput, writeDir }
// 内部：策略 apply → 拼 entry → output.write({entry, collectOutput, writeDir}) → return 1
// → number（调用方 outputCount += result）
// A→B 演化（刀 3 若需"只产不写"）：拆 emitEntry → {entry} + output.write 外部调——加法

// output.write —— 不管 count、不管 rebase
write({
  entry: { entryId, kind, files: [{path, code}], sourcemaps?: [{path, map}] },
  collectOutput,              // postMessage(M1) vs fs
  writeDir,                   // mkdir + writeFileSync（直写路径用）
})
// → void

// filename 语义：不含扩展名的 basename（view/style 从 page.path 派生；logic 固定 'logic'）；
// 扩展名由 strategy 内部加（.js / .css）；sourcemapFileName = `${filename}.js.map`（logic 恒 logic.js.map）。
```

## 8. 决策表

| ID | 决策 | 一句话理由 |
| --- | --- | --- |
| D-E-1 | emit 输入 = 模块集合接口（iterable） | 契约先立，缓存后做提供者（解耦刀 1/刀 3） |
| D-E-2 | transform 策略 = 函数注入（非标志位 if） | 防伪抽象——差异封装在各自 apply |
| D-E-3 | emitOutput 统一出口（postMessage/fs） | 消 9 处直写 + 各自 mkdir |
| D-E-4 | contract 不含 deps | 依赖留图维度 1，单一职责 |
| D-E-5 | 只搬不优化 | 不统一 transform 粒度、不改产物语义 |
| D-E-6 | contract 不含 range/sourceFile | 错误定位是布局私有；source 在 map 内 |
| D-E-7 | output.js 独立 | emit 无副作用 / output 有副作用；未来增量写盘/材质化复用 |
| D-E-8 | style 只收 output（不进 emitEntry） | 无模块体系/无 modDefine/无 transform——硬套=伪抽象 |
| D-E-9 | 方案 A：emitEntry 内部调 output.write | 样板消最多；返回 number；A→B 是加法 |
| D-E-10 | 纯参数 + outputEnv（不引入 EmitContext） | 不绑 worker 上下文；参数不膨胀 |
| D-E-11 | outputCount 在 emitEntry 层（output.write 不管） | output.write 更纯；count 是协议对账字段 |
| D-E-12 | rebase 留策略（output.write 只含 writeDir） | rebase 是产物内容操作，不是写盘职责 |

## Residual

- 本刀不实现刀 2/刀 3（失效查询/ModuleCache）——契约接口已立，后续提供者守约即可。
- style 只收写盘（不建 emitEntry）——产物形态差异本质，收纳式重构。
- R1-R7 review 历史详见 git log（每轮 commit message 含完整 findings 摘要）。
