# Research — fe-tools-ts-migration

## 1. 现状摸排

### 1.1 文件分布

`bundler/src/` 下 72 .js + 6 .ts：

| 目录 | .js | .ts |
| --- | --- | --- |
| src/ 根 | 2（index.js 等）| 0 |
| src/bin/ | 3 | 0 |
| src/compiler/core/ | 8 | 0 |
| src/compiler/pipeline/ | 6 | 2 |
| src/compiler/view/ + wxml/** | 14 | 4 |
| src/compiler/logic/ | 2 | 0 |
| src/compiler/style/ | 2 | 0 |
| src/compiler/worker-runtime/ | 6 | 0 |
| src/dev/ | 5 | 0 |
| src/model/ | 6 | 0 |
| src/session/ | 4 | 0 |
| src/shared/ | 8 | 0 |
| src/watch/ | 3 | 0 |
| **合计** | **72** | **6** |

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

### 阶段 1：core/ + shared/ 基础（16 文件，被 import 最多）

shared/（8，被 compiler/session/model import）+ core/（8，env.js 被 34 处 import）。

### 阶段 2：worker-runtime/（6 文件，worker 直跑）

context（5）→ define-engine/loggers（3）→ runtime（3）→ sinks/executor（1）。
worker strip-types 已注入。

### 阶段 3：pipeline/ + model/ + session/ + watch/（19 文件）

pipeline（6）+ model（6，build-model 等）+ session（4）+ watch（3，worker-pool 等）。
emit（2）被 view/logic/style import；build-model 被多 import。

### 阶段 4：view/ + view/wxml/（14 文件）

index（6）+ worker-entry + wxml/parse（3）+ compile + document/document-ops（3）+ load/* + renderer/vue/* + cheerio/napi。

### 阶段 5：logic/ + style/ + dev/ + bin/ + src/根（14 文件）

logic/style index + worker-entry（4）+ dev（5）+ bin（3）+ src/根（2）。

### 阶段 6：__tests__/ import 后缀（可选，D-TM-2 待拍板）

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

## 6. R1 review（2026-09-16）

### R1 findings

#### F1 — 🟠 __tests__ D-TM-2 必须 scope 内（high）

- **Evidence**: requirements Non-goals "不改 __tests__/"；但测试 `import { ... } from '../../src/compiler/core/env.js'` 等——P-TM01 改 env.js→env.ts 后，测试 import `.js` 找不到文件 → 崩溃
- **Broken edge**: Non-goals "测试留后续"不可行——改名后测试立即崩溃，必须同步改 import 后缀
- **Correction**: D-TM-2 拍板 **scope 内**（__tests__ import .js→.ts 同步改），P-TM06 改为各阶段同步（非独立步）

#### F2 — 🟡 方案 A 要改现状 .ts 文件的 import 后缀（medium）

- **Evidence**: `parity.ts:7` import `./document.js`（.ts 文件 import .ts 用 .js 后缀）；research §2.2 只说"方案 A 显式 .ts"但没提**现状 .ts 文件也要改**
- **Broken edge**: P-TM04 改 document.js→document.ts，parity.ts 的 `./document.js` 要改 `./document.ts`（方案 A）。research 漏提
- **Correction**: research §2.2 补"现状 .ts 文件 import .ts 用 .js 后缀，方案 A 要同步改 .ts"

#### F3 — 🟠 POC 证伪方案 A 纯改名（high → blocker）

- **Evidence**: POC `document.js→document.ts` + `parity.ts import './document.ts'` → tsc 报 `TS2305: Module '"./document.ts"' has no exported member 'Attr'`
- **Root cause**: `.js→.ts` 后 tsc **开始类型检查**（checkJs:false 只管 .js，不管 .ts）；document.js 用 JSDoc `@typedef` 定义 Attr/Value，.ts 里 `@typedef` 不工作，tsc 认为缺失 export
- **Broken edge**: 方案 A（纯改名）证伪——72 .js→.ts 后 tsc 检查所有 .ts，隐式 any / 缺失类型 / JSDoc @typedef 失效 → tsc build 失败
- **Correction**: D-TM-4 升级为 blocker——纯改名不可行，必须定类型检查策略

#### F4 — 🟢 vitest vite resolve .ts 显式后缀未验证（low）

- **Evidence**: vite 默认 resolve .ts，但 import 显式 .ts 后缀是否 resolve 未验证
- **Correction**: POC 验证（tsc build 失败前 vitest 未跑）

#### F5 — 🟢 dist 产物字节不变已验证（low）

- **Evidence**: parity.ts 编译 dist parity.js，字节同（POC 前）
- **Correction**: 无

### R1 POC 证伪详情

POC 步骤：
1. `document.js → document.ts`（改名）
2. `parity.ts / document-ops.js / compile.js / wxml-ir.types.ts` import `./document.js` → `./document.ts`
3. `tsc -p tsconfig.build.json` → 报错：
   - `TS2305: Module '"./document.ts"' has no exported member 'Attr'`
   - `TS2305: Module '"./document.ts"' has no exported member 'Value'`

根因：document.js 用 JSDoc `@typedef {object} Attr` 定义类型。`.js` 时 tsc checkJs:false 不检查，wxml-ir.types.ts import `./document.js` 时 tsc 当 any 不报错。改 `.ts` 后 tsc 强制检查——`@typedef` 在 .ts 里不工作，Attr/Value 视为未 export → 报错。

### D-TM-4 升级（blocker）

原 D-TM-4："是否加类型注解（checkJs）——Non-goals 保持 false？"

**升级为 blocker**：纯改名不可行，必须先定类型检查策略。修正方向：

| 选项 | 代价 | 评价 |
| --- | --- | --- |
| A. tsconfig 放宽（noImplicitAny:false + skipLibCheck）| 允许 any，tsc 过 | ✗ 迁移无类型安全增益 |
| B. JSDoc→TS type 完善类型注解 | 9 @typedef + 361 @param/@returns 转 TS | ✓ 类型体系完善 |
| C. `// @ts-nocheck` 每个 .ts | 不优雅 | ✗ 类型安全零 |
| D. 保持 .js（放弃迁移）| 现状 | ✗ 无 TS 类型安全 |

**用户方向（2026-09-16）**：不用 any，类型体系应该完善 → **选项 B**（JSDoc→TS type）

### JSDoc 类型资产统计

- 4 文件用 `@typedef`（9 个类型定义）：document.js / document-ops.js / emit.js / napi/parse.js
- 361 个 `@param/@returns`（函数签名）
- JSDoc 是类型信息来源——转 TS `type/interface` + 函数签名注解是机械转换 + 完善

### R1 verdict

**blocker** —— F1（high）+ F3（blocker 证伪方案 A 纯改名）+ F2（medium）+ F4/F5（low）。D-TM-4 升级 blocker，必须拍板类型策略（选项 B）才能升 ready。

## 7. R2 review（2026-09-16）

### R2 摸排

#### tsconfig strict 现状

- `tsconfig.json`（IDE/typecheck）：`strict: true` + `module: NodeNext` + `moduleResolution: NodeNext` + `noEmit: true` + `skipLibCheck: true`
- `tsconfig.build.json`（build）：`extends: ./tsconfig.json`（**继承 strict:true**）+ `noEmit: false` + outDir + `rewriteRelativeImportExtensions: true`
- 现状 `tsc --noEmit`（.js 不检查 .ts 检查）：**0 错误**（.ts 文件已类型完善）
- `tsc --noEmit --checkJs`（模拟 .ts 全检查）：**1134 错误**

#### 第三方类型资产

- `node_modules/@types/` 空——无第三方 @types 包
- 第三方包（listr2, mitt 等）类型靠 `skipLibCheck:true` 跳过 + 推断

### R2 findings

#### F6 — 🟠 类型注解工作量巨大（high）

- **Evidence**: `tsc --checkJs --noEmit` 报 1134 错误（strict 模拟）
- **错误分布**：
  - TS7006 隐式 any 参数：594（52%）——函数参数加 `:type`
  - TS2339 property any：237（21%）——any 链路访问，需上游类型化
  - TS7005 变量接收函数隐式 any：54
  - TS7031 解构 binding 隐式 any：48
  - TS7053 索引 any：35
  - TS18046 any 计算：33
  - TS7034 变量隐式 any：30
  - 其他（2322/2345/2314）：31
- **隐式 any 类（7006/7005/7031/7034）= 726 个（64%）**——机械加 `:type` 可解
- **property any（2339）237 个**——需上游类型化才能消除
- **Correction**: 工作量大但可管理——分阶段（基础类型先行）

#### F7 — 🟡 checkJs 低估实际错误量（medium）

- **Evidence**: R1 POC 证明 @typedef 在 .ts 失效（TS2305）；checkJs 下 @typedef 工作（不报错），但 .ts 后 @typedef 相关 import 报 TS2305
- **Broken edge**: 1134 是**下限**——实际 .js→.ts 后 @typedef 失效，额外报错（9 @typedef × 多处 import）
- **Correction**: 9 @typedef → TS type 转换是**先行步骤**（消除 TS2305 链式报错）

#### F8 — 🟡 第三方包无 @types（medium）

- **Evidence**: `node_modules/@types/` 空；第三方包（listr2, mitt, cheerio 等）类型靠 skipLibCheck 跳过
- **Broken edge**: 业务代码 import 第三方包时，参数/返回类型可能隐式 any
- **Correction**: 评估 listr2/mitt/cheerio 是否自带 .d.ts；缺失的用局部 type 声明

#### F9 — 🟢 分阶段类型化策略（low）

- **Evidence**: 错误集中——env.js(103) / view/index.js(101) / napi/parse.js(91) / style/index.js(86) / logic/index.js(59) / compatibility.js(38) / shared/utils.js(35)
- **Correction**: 类型化按依赖图分层：
  1. 基础层：@typedef → type（9 个，4 文件）——消除 TS2305 链式报错
  2. shared/ + core/env.js（被 34 处 import）——基础类型渗透
  3. core/ 其余 + model/session ——业务类型
  4. compiler/view/logic/style ——叶子类型
  5. worker-runtime + bin + dev + watch

### R2 verdict

**pass-with-findings** —— F6（high 工作量 1134）+ F7（medium checkJs 低估）+ F8（medium 第三方类型）+ F9（low 分阶段策略）。工作量评估完成——1134+ 错误，分阶段类型化可行。

## 8. R3 review（2026-09-16）

### R3 深入摸排

#### 9 个 @typedef 完整形状

- `document.js`：`Span{start,end}`, `Document{span?,body,sourceFile?}`, `Value{kind:'static'|'expr'|'template',raw,span?}`, `Attr{span?,name,value?}`
- `document-ops.js`：`WxmlDocument`（re-export `import('./wxml-ir.types.js').WxmlDocument`）, `Document`（re-export `import('./document.js').Document`）
- `emit.js`：`EmitModule{moduleId,code,map:string|null,extraInfoCode?}`, `ModuleCollection`（Iterable<EmitModule>）
- `napi/parse.js`：`SourceContext{source:string,buf:Buffer,byteToChar:Int32Array}`

#### 第三方包类型

- `listr2`：自带 `./dist/index.d.mts` ✓
- `cheerio`：自带 `./dist/commonjs/index.d.ts` ✓
- `mitt`：不在 `node_modules`（monorepo/SDK 内置，需定位）

#### env.js TS2339 动态对象根因

- `env.js` 103 错：59 TS2339（property any）+ 33 TS7006（隐式 any 参数）
- TS2339 示例：`Property 'template' does not exist on type '{}'`
- 根因：config 动态对象字面量推断为 `{}`，字段访问 `.template/.style/.dependencyGraph` 报错
- 修正：定义 `CompileConfig` interface 后字段访问不再 any

#### 复杂函数签名

- `runtime.js`：`makeProgress(parentPort)`, `runWorker(engine)`
- `executor.js`：`executeTask({ engine, input, onOutput, onProgress })`
- `define-engine.js`：`defineEngine(overrides)`
- 都是 D-WR-1..9 已定义契约，类型形状可从 worker-runtime design 拿

### R3 findings

#### F10 — 🟢 9 @typedef 形状清晰（low）

- **Evidence**: 全 object 结构，@property 字段清晰（Span/Document/Value/Attr/EmitModule/SourceContext）
- **Correction**: 直接转 TS `type`/`interface`，无难点

#### F11 — 🟢 第三方包类型（low）

- **Evidence**: listr2 + cheerio 自带 .d.ts；mitt 需定位（monorepo）
- **Correction**: 查 mitt 位置；缺失的局部 type 声明

#### F12 — 🟡 env.js TS2339 动态对象（medium）

- **Evidence**: env.js 59 TS2339——config 动态对象字面量推断为 `{}`，字段访问报错
- **Root cause**: CompileConfig 类型未定义，对象字面量推断为空对象
- **Correction**: P-TM02 定义 CompileConfig interface 后，env.js TS2339 链式消除

#### F13 — 🟢 复杂函数签名（low）

- **Evidence**: runtime/executor/define-engine 函数签名都是 D-WR 契约，形状已知
- **Correction**: 从 worker-runtime design 拿类型形状

### R3 verdict

**pass-with-findings** —— F10/F11/F13（low 无难点）+ F12（medium CompileConfig 类型定义是关键）。类型形状全部清晰，无新 blocker。可升 ready。

## 10. R5 review（2026-09-16，ready gate 终检）

### R5 findings（文档同步问题，R4 升 ready 时未完全同步）

#### F14 — 🟡 acceptance A-TM2 备注过时（medium）→ 已修

- acceptance A-TM2 "D-TM-2 待拍板" → 改"已拍 scope 内"

#### F15 — 🟡 validation V-TM 编号不连续 + 未同步分阶段（medium）→ 已修

- validation 补全 V-TM01..08 对应 P-TM01..08

#### F16 — 🟡 validation 映射表缺 A-TM5（medium）→ 已修

- 补 A-TM5 → V-TM08

#### F17 — 🟡 README readiness gaps 未更新（low）→ 已修

- "待 R4 升 ready" → "已 ready，待授权实施"

#### F18 — 🟡 A-TM1 evidence "除 src/ 外"过时（low）→ 已修

- "src/compiler import（除 src/ 外）" → "bundler/src import"

#### F19 — 🟡 P-TM01 验证点过严（medium）→ 已修

- "TS2305 清零" → "TS2305 链式清零（该文件其他隐式 any 留 P-TM02..06）"

#### F20 — 🟡 technical-design Non-goals 全错（high）→ 已修

- "不做：类型注解、src/compiler 外迁移、测试文件迁移（待 D-TM-2 拍板）" → "行为改变 / 不用 any / 不改 scripts/crates / 不改测试逻辑（仅后缀）"

#### F21 — 🟡 validation V-TM07 grep 范围过窄（low）→ 已修

- grep "src/compiler" → "src/"

### R5 verdict

**pass** —— F14-F21 全是文档同步问题，已全部落盘修正。无技术 blocker。ready gate 通过，可授权实施。

## 11. R6 review（2026-09-16，实施前技术风险终检）

### R6 验证

- tsconfig include 覆盖全 src（`src/**/*.js` + `src/**/*.ts`）✓
- mitt/listr2/cheerio 第三方类型无 tsc 错误 ✓
- CompileConfig/FileTypes 形状清晰（resolveCompileConfig 返回 + fileTypes 字段）✓
- type-only import .ts 后缀（R4 POC 已验证）✓
- 分阶段中间状态 vitest（现状 build-pipeline.js import .ts，584/584）✓
- P-TM01 @typedef 字段全清晰（Value/Attr/Document）✓
- worker strip-types 注入点：只在 executor.js（不在 stage-channel）⚠

### R6 findings

#### F22 — 🟡 A-TM4/V-TM08 grep 目标错误（medium）→ 已修

- **Evidence**: `grep -n "experimental-strip-types" src/compiler/pipeline/stage-channel.js` 无输出；strip-types 只在 `src/compiler/worker-runtime/executor.js:23`
- **Root cause**: worker-runtime 重构后 `new Worker` only executor.js（D-WR-5 thin entry + executor）；stage-channel.js 不创建 worker
- **Correction**: acceptance A-TM4 + validation V-TM08 grep 目标改为只 `executor.js`（去掉 stage-channel）

#### F23 — 🟢 tsconfig include 覆盖全 src（无 finding）

### R6 verdict

**pass-with-findings** —— F22（medium，文档修正）+ F23（🟢 验证通过）。仅 1 个文档修正点，无技术 blocker。可授权实施。

## 9. 拍板 D-TM-1/2/3 + 升 ready（2026-09-16）

### D-TM-1 = 方案 A（显式 .ts）✓ 拍定

**POC 验证**：
- `.ts` 文件 import `.ts` 显式 `.ts` 后缀（目标已是 .ts）→ `tsc --noEmit` **0 错误**
- `compile-target.ts` import `'./compile-target.types.ts'` → tsc 通过 + dist build OK
- tsc `rewriteRelativeImportExtensions` 把 `.ts` import rewrite 成 `.js` in dist

**规则**：
- 所有 import .ts 用显式 `.ts` 后缀（统一）
- tsc rewrite `.ts`→`.js` in dist（Node native dist 跑 OK）
- vite resolve `.ts`（vitest OK）
- worker `/src/` 走 `--experimental-strip-types`（现状已注入）

### D-TM-2 = scope 内（__tests__ import .js→.ts 同步改）✓ 拍定

**F1 依据**：改名后测试 import `.js` 找不到文件 → 崩溃，必须同步改。

**规则**：`__tests__/` import `src/` 的后缀同步改 `.ts`（仅后缀，不改测试逻辑）。

### D-TM-3 = 分阶段 + 跨 import 后缀修正 ✓ 拍定

**阶段顺序**（按依赖图被 import 次数降序）：
1. P-TM01 @typedef→type（9 个 4 文件，消除 TS2305 链式）
2. P-TM02 shared/ + core/env.js（基础渗透，env 被 34 处 import）
3. P-TM03 core/ 其余 + worker-runtime/
4. P-TM04 pipeline/ + model/ + session/ + watch/
5. P-TM05 view/ + logic/ + style/
6. P-TM06 bin/ + dev/ + src/根
7. P-TM07 __tests__/ import 后缀
8. P-TM08 全量验证

**跨 import 后缀修正**：每阶段改本阶段 `.js`→`.ts` + grep 所有 import 本阶段的文件改后缀 `.ts`（含跨阶段文件，仅改后缀不改名）。

**分阶段可行性**（POC 验证）：
- tsc NodeNext 能 resolve `.js` import 到 `.ts`（现状 compile-target.ts import `./compile-target.types.js`，0 错误）
- 但 Node native worker 不 fallback——worker 文件 import `.ts` 必须显式 `.ts`（方案 A 统一显式 .ts 解决）
- `.js` 文件 `checkJs:false` → tsc 不检查 → 分阶段中间状态 `.js` 文件不报错
- 每阶段 `.ts` 闭环类型注解 → tsc build 该阶段过

### R4 verdict

**ready** —— D-TM-1/2/3 拍定 + POC 验证方案 A 可行 + 类型形状清晰 + 工作量评估完成（1134 错误，分阶段可行）。升 ready。
