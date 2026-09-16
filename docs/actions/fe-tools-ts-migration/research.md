# Research — fe-tools-ts-migration

## 1. 现状摸排

### 1.1 文件分布

`src/compiler/` 下 41 .js + 6 .ts：

| 目录 | .js | .ts |
| --- | --- | --- |
| core/ | 8（env, compatibility, sourcemap, renderers, expression-parser, npm-builder, npm-resolver, compatibility-reference）| 0 |
| pipeline/ | 6（build-pipeline, compile-stages, config-compiler, emit, publish, stage-channel）| 2（compile-target, compile-target.types）|
| view/ | 2（index, worker-entry）| 0 |
| view/wxml/ | 12（parse, compile, cheerio/parse, napi/parse, common/document, document-ops, load/*, renderer/vue/*）| 4（renderer/registry, renderer/stub, common/parity, common/wxml-ir.types）|
| logic/ | 2（index, worker-entry）| 0 |
| style/ | 2（index, worker-entry）| 0 |
| worker-runtime/ | 6（context, runtime, executor, sinks, loggers, define-engine）| 0 |
| **合计** | **41** | **6** |

### 1.2 import 后缀现状

- **.js 文件 import .ts**：显式 `.ts` 后缀（3 处：build-pipeline→compile-target.ts, view/index→registry.ts, wxml/compile→registry.ts）——D-TD-20 Node worker 无法解析隐式映射
- **.ts 文件 import .ts**：`.js` 后缀（如 parity.ts→wxml-ir.types.js）——tsc rewriteRelativeImportExtensions rewrite
- **.ts 文件 import .js**：`.js` 后缀（现状，改 .ts 后要改 .ts 后缀）
- **.js 文件 import .js**：`.js` 后缀（改 .ts 后，import 方要改 .ts 后缀）

### 1.3 依赖图（被 import 次数，定分阶段）

| 次数 | 文件 | 迁移影响 |
| --- | --- | --- |
| 34 | core/env.js | 全局基础，先迁 |
| 8 | core/compatibility.js | |
| 7 | logic/index.js | |
| 6 | view/index.js + core/sourcemap.js | |
| 5 | worker-runtime/context.js + core/renderers.js | |
| 3 | worker-runtime/runtime/loggers/define-engine + view/wxml/parse/document/document-ops + style/index | |
| 2 | pipeline/emit + core/npm-resolver + expression-parser | |
| 1 | worker-runtime/sinks/executor + view/wxml/load/* | |

### 1.4 src/ 外依赖

- `src/shared/`、`src/bin/` 不 import `src/compiler/`（无跨目录 import）
- `__tests__/` import `src/compiler/` 用 `.js` 后缀（改 .ts 后要改 .ts 后缀）——Non-goals 留后续？或一并改？

## 2. D-TD-20 限制 + 策略

### 2.1 限制

- `.js`→`.ts` 隐式映射只在 tsc 程序中
- vitest (vite pipeline) + worker (Node native) 无法解析隐式映射
- Node native worker 需要 `--experimental-strip-types` execArgv（现状已注入 stage-channel/executor）

### 2.2 后缀策略（决策点）

**方案 A（显式 .ts）**：所有 import .ts 用显式 `.ts` 后缀。
- 优点：Node native + vite + tsc 都解析
- 缺点：dist tsc rewrite（.ts→.js）需 rewriteRelativeImportExtensions（已配置）
- 现状：.js import .ts 已用此模式（3 处）

**方案 B（.js tsc rewrite）**：.ts 文件间 import 用 `.js` 后缀，tsc rewrite。
- 优点：.ts 源码 import 统一 .js 后缀
- 缺点：Node native worker 无法解析（.js 文件不存在 in /src/）——worker-entry/runtime/executor 在 /src/ 直跑会失败
- 现状：.ts import .ts 已用此模式（parity.ts→wxml-ir.types.js）

**方案 C（混合）**：worker 直跑的文件（worker-runtime + worker-entry）用显式 .ts；非 worker 文件用 .js tsc rewrite。
- 优点：worker 可跑 + 非 worker tsc rewrite 统一
- 缺点：两套规则，复杂

**建议：方案 A（显式 .ts）**——统一规则，Node/vite/tsc 都解析，tsc rewrite 已配置。worker 已注入 strip-types。

## 3. 分阶段实施

### 阶段 1：core/ 基础（8 文件，被 import 最多）

env.js（34）→ compatibility/sourcemap/renderers（6-8）→ expression-parser/npm-builder/npm-resolver/compatibility-reference（2）。

### 阶段 2：worker-runtime/（6 文件，worker 直跑）

context（5）→ define-engine/loggers（3）→ runtime（3）→ sinks/executor（1）。
worker strip-types 已注入。

### 阶段 3：pipeline/（6 文件）

build-pipeline/compile-stages/config-compiler/emit/publish/stage-channel。
emit（2）被 view/logic/style import。

### 阶段 4：view/ + view/wxml/（14 文件）

index（6）+ worker-entry + wxml/parse（3）+ compile + document/document-ops（3）+ load/* + renderer/vue/* + cheerio/napi。

### 阶段 5：logic/ + style/（4 文件）

index（7/3）+ worker-entry × 2。

### 阶段 6：__tests__/ + helpers（可选，Non-goals 留后续？）

测试 import .js→.ts 后缀修正（如 scope 内）。

## 4. 行为 0 风险

- **改名 + 后缀**：不改逻辑，diff=0 应保证
- **tsc build**：.ts 文件 + rewriteRelativeImportExtensions + allowImportingTsExtensions 已配置
- **vitest**：vite resolve .ts/.js 自动
- **worker strip-types**：/src/ 时 execArgv 注入，dist 全 .js 无影响
- **dist 产物**：tsc 编译 .ts → .js in dist，产物字节不变

## 5. 决策点（待 review 拍板）

- **D-TM-1**：后缀策略 = 方案 A（显式 .ts）vs B（.js rewrite）vs C（混合）
- **D-TM-2**：__tests__/ scope 内 vs Non-goals
- **D-TM-3**：分阶段顺序（core → worker-runtime → pipeline → view → logic/style）
- **D-TM-4**：是否加类型注解（checkJs）——Non-goals 保持 false？
