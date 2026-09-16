# Technical Design — fe-tools-bundler-emit-layer

Status: **冻结 v1（2026-09-15）** — D-E-1..8；与 requirements / plan / acceptance 同步。

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
        └─ pipeline/emit.js  emitEntry(...)
             ├─ transform 策略注入（bundle / perModule —— 各自 apply + 错误定位）
             └─ → pipeline/output.js  write({path, content, map?, collectOutput})
                    └─ collectOutput ? postMessage(M1) : mkdir + writeFileSync
src/compiler/style/index.js
  └─ → pipeline/output.js  write({path, css/map, collectOutput})   // 不经 emitEntry
```

## 3. 模块集合契约（D-E-1/D-E-6）

```js
/**
 * 模块集合：emit 的输入规约（不绑定具体容器）。
 * 提供者：现在 scriptRes（Map）/ compileRes（Array）；未来 ModuleCache（刀 3）。
 * @typedef {{ moduleId: string, code: string, map?: string | null }} EmitModule
 * @typedef {Iterable<EmitModule>} ModuleCollection
 */
```

不含 range/sourceFile——错误定位（moduleRanges）是 bundle 策略在拼接布局时**私有生成**，不进模块属性（缓存了也随每次 emit 布局失效）。

**R1-F2（map 自包含 source）**：logic compileInfo 有 `sourceFile` 字段（MagicString 用，生成 `generatedMap.sources = [sourceFile]`），但最终进了 `module.map.sources`——**map 已自包含 source 路径**，rebase 从 `module.map.sources` 取。故 contract 不需要 sourceFile 字段 ✓。

## 4. transform 策略（D-E-2）

```js
// emit.js 内
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
      // R1-F3：sourcemap rebase 在此步——rebase module.map.sources
      //        （绝对路径 → relative(finalOutputDir, resolve(workPath, sourcePath))）
    },
  },
}
// emitEntry 通过 cfg.transform.strategy 选取，函数注入防伪抽象
```

两个策略都是"模块集合 → 单文件产物"的交互层；差异（整包 vs 逐模块、定位方式）封装在各自 apply。

### 4.1 `enableSourcemap × effectiveJsMinify` 交叉矩阵（R1-F4 · 实施必读）

| 策略 | sourcemap | minify | 产物路径（实证） |
| --- | --- | --- | --- |
| **bundle**（view） | ✓ | ✗（CF-1） | mergeSourcemap → bundleCode+map → `//# sourceMappingURL=` 拼接 |
| **bundle**（view） | ✗ | ✓ | 整包 transform(minify:true, target:view, platform:browser) |
| **bundle**（view） | ✗ | ✗ | 整包 transform(minify:false, target:view, platform:browser) |
| **perModule**（logic） | ✓ | ✗（CF-1） | rebase map.sources → mergeSourcemap → `//# sourceMappingURL=` 拼接 |
| **perModule**（logic） | ✗ | ✓ | 逐模块 transform(minify:true, target:logic, platform:neutral) → 拼接 |
| **perModule**（logic） | ✗ | ✗ | 直接 modDefine 拼接（无 transform） |
| **style**（不经 emitEntry） | ✓ | — | compileSS 内 `/*# sourceMappingURL= */` 拼接 → output.write |
| **style** | ✗ | — | compileSS → output.write(css) |

**CF-1 约束**：`effectiveJsMinify = minify && !sourcemap`——sourcemap 模式跳过 minify（mergeSourcemap 只做单层行偏移，串联两份 map 未实现）。策略 apply 必须守此约束。

## 5. output（D-E-7/D-E-8）

```js
// pipeline/output.js —— 唯一写盘出口（materialize 名不副实修复）
write({ path, content, map, collectOutput })  // collectOutput ? postMessage(M1) : mkdir+write
```

- collectOutput 路径：postMessage({ type:'output', entry })——**R1-F6**：entry 形状 = `{ entryId, kind, files:[{path,code}], sourcemaps?:[{path,map}] }`，与 BuildModel.add 入参**完全一致**（三引擎实证一致，不引入新形状）；
- 直写路径：mkdir -p（原各引擎 mkdirSync 逻辑收口）+ writeFileSync；
- style 只调 write（D-E-8），不经 emitEntry。
- **R1-F5（sourceMappingURL 拼接位置）**：view/logic 的 `//# sourceMappingURL=` 在 **emitEntry** 拼接；style 的 `/*# sourceMappingURL= */` 在 **compileSS 内部**拼接（不经 emit）。两个拼接点不统一——可接受（style 不经 emit），output.write 收到的是已含拼接的 code。

## 6. 行为 0（R-E4）

- emitEntry/output 抽取出后，三引擎传原参数组合 → 产物字节不变（view moduleRanges 计算逻辑原样迁入 bundle 策略；logic 逐模块 transform 原样迁入 perModule 策略）。
- 验收 = 三链对拍 diff=0；vitest 全量。


## 7. R2 Review findings（worker 协议与参数面 · 2026-09-15）

### R2-F0：R1 落盘执行缺陷（已修复）

`38e6617e` commit message 声称"F1-F6 收敛"，但 heredoc 语法错误导致 F2-F5 实际丢失。R2 已补回（见上 §3/§4/§5 各 R1 标注）。

### R2-F1（🔴）：emitEntry 参数面不完整——worker 全局变量归属

**实证**：view/logic/style 各自持有私有全局：
- `collectOutput`（worker 初始化时从 message 设）
- `outputCount`（postMessage output 后各自 `++`）
- `activeCompileConfig`（minify/sourcemap/esTarget 来源）
- `enableSourcemap` / `sourcemapTargetPath`（logic rebase 用）

**问题**：emitEntry 签名当前只列 `{entryId, kind, modules, transform, filename, sourcemap, collectOutput}`——缺 `activeCompileConfig`（target/platform/minify）、`sourcemapTargetPath`（rebase）、`relPrefix`（物化路径前缀）。若纯函数化，参数膨胀到 10+；若闭包捕获全局，则 emitEntry 不可复用（绑 worker 上下文）。

**建议**：emitEntry 接受一个 **EmitContext** 对象（聚合 worker 全局：`{compileConfig, sourcemapTargetPath, relPrefix, collectOutput, outputCount ref}`），不逐个罗列——ctx 注入而非参数膨胀。outputCount 作为可变引用（R2-F2）。

### R2-F2（🟠）：outputCount 在 worker 完成消息里（协议层耦合）

**实证**：worker 完成消息 `{success, compatibilityWarnings, dependencyGraph, outputCount}`（view:281/logic:82）——outputCount 不只是 emit 计数，是 **worker 协议的完成确认**字段。

**问题**：output.write 抽取后，`outputCount++` 该在哪做？output.write 内部 postMessage 后 ++——需要**可变状态引用**（非纯函数）。

**建议**：output.write 接受 `EmitContext`（含 outputCount 可变引用），内部 postMessage 后 `ctx.outputCount++`——保留 worker 协议不变，但 output.write 非纯函数（有副作用：改 ctx.outputCount + postMessage）。声明此副作用。

### R2-F3（🟠）：outputDir 计算不统一（三引擎各自算）

**实证**：
- view/style：`outputDir = root ? getTargetPath()/root : getTargetPath()/main`
- logic（sourcemap 时）：`finalOutputDir = resolve(sourcemapTargetPath, root|main)`——**与 outputDir 不同**（rebase 用 sourcemapTargetPath，写盘用 getTargetPath）

**问题**：output.write 统一 mkdir/write 时，写盘路径用 `getTargetPath()`，但 logic sourcemap rebase 用 `sourcemapTargetPath`——两个路径**可能不同**（sourcemapTargetPath 在 worker init 时可被 message 覆盖为别的值）。

**建议**：output.write 参数区分 `writeDir`（写盘，getTargetPath）与 `rebaseDir`（sourcemap rebase 基准，sourcemapTargetPath）——两个路径参数，非一个。

### R2-F4（🟡）：style 的 `options.sourcemap` vs 全局 `enableSourcemap`

**实证**：style 用 `options.sourcemap`（函数参数，95 行），view/logic 用全局 `enableSourcemap`——sourcemap 开关来源不同。

**影响**：output.write 或 emitEntry 抽取时 sourcemap 开关来源需统一。style 不经 emitEntry，其 sourcemap 从 options 来——output.write 参数需显式传 `sourcemap` flag（不从全局读）。

### R2-F5（🟡）：R1-F4 交叉矩阵的 style minify 象限

R1-F4 矩阵已含 style 两行（sourcemap ✓/✗），minify 列标"—"——因为 style 无 esbuild transform（CSS 编译在 buildCompileCss 内）。**正确**（style 无 minify 象限），但应在矩阵注脚声明"style 的 CSS minify 在 buildCompileCss 内部，不经 emit/output"。

## 8. R2 讨论收敛（2026-09-15 · 逐项拍板）

### R2-C1：纯参数 + outputEnv 小聚合（不引入 EmitContext）

emitEntry 参数分两组：
- **本质参数**（产物生成逻辑）：`{entryId, kind, modules, transform, filename, sourcemap, relPrefix}`
- **outputEnv**（写盘/协议，3 字段小聚合，透传给 output.write）：`{collectOutput, writeDir}`

不引入大 EmitContext（13 字段聚合体）——emitEntry 不绑 worker 上下文，未来主线程直接 emit/测试可复用。worker 初始化时组装这两组参数。

### R2-C2：outputCount 累加在 emitEntry 层（output.write 不管 count）

- **output.write 不管 count**——只做 postMessage(M1)/fs.write，不维护计数。
- **outputCount 在 emitEntry 层累加**——每次 emitEntry 调 output.write 产 1 个 entry 后，调用方/emitEntry 自增 count。
- worker 完成消息的 `outputCount` = emitEntry 层累加值（协议对账字段，stage-channel 主线程对账 `message.outputCount !== receivedOutputCount`）。
- output.write 更纯（只 postMessage/fs，无可变状态引用）。

### R2-C3：rebase 留 emitEntry 策略（output.write 只含 writeDir）

- **output.write 参数只含 `writeDir`**（写盘路径，getTargetPath 派生）——只管 mkdir+writeFileSync / postMessage。
- **sourcemap rebase 留在 emitEntry 的 perModule.apply 内**（R1-F3 已定）——rebase 是产物内容操作（module.map.sources 改写），跟 sourcemap 策略一起，不是写盘职责。
- `sourcemapTargetPath` 是 emitEntry 的参数（perModule.apply 用），不进 output.write。
- logic 的 sourcemapTargetPath 是 build-model M2 概念（产物发布位置），emit 借用做 rebase 基准——有意设计，保留。

### 修正后的签名

```js
// emitEntry 本质参数 + outputEnv
emitEntry({
  entryId, kind,
  modules,                    // iterable<{moduleId, code, map}>
  transform: { strategy, minify, target, platform },
  sourcemap,                  // bool
  sourcemapTargetPath,        // string | null（perModule rebase 基准，仅 logic）
  filename, relPrefix,
}, outputEnv)                 // { collectOutput, writeDir }

// output.write（不管 count、不管 rebase）
write({
  path, content, map?,        // 产物内容（已含 sourceMappingURL 拼接）
  collectOutput,              // postMessage(M1) vs fs
  writeDir,                   // mkdir + writeFileSync
})
// 返回值：void（count 由 emitEntry 层累加）
```

## Residual

- 本刀不实现刀 2/刀 3（失效查询/ModuleCache）——契约接口已立，后续提供者守约即可。
- style 只收写盘（不建 emitEntry）——产物形态差异本质，收纳式重构。