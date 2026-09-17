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

## 12. R7 review（2026-09-16，实施流程深挖）

### R7 findings

#### F24 — 🟡 P-TM01 @typedef 链式 import 修正范围未列（medium）→ 已修

- **Evidence**: `document.js` 被 9 处 import（wxml-ir.types.ts + parity.ts + document-ops + tools + load/index + load/include + cheerio/parse + compile + parse）
- **Correction**: implementation-plan P-TM01 补 import 修正文件清单（9 处 document + emit + napi-parse 的 import 方）

#### F25 — 🟡 TS7023 递归函数 + TS7031 事件回调解构难点未提（medium）→ 已修

- **Evidence**:
  - TS7023 自引用 any：`resolveModuleIdToExistingPath` / `buildCompileView` / `projectChildren`（递归函数返回类型推断不了）
  - TS7031 解构：`{ event, filePath, count }`（bin/index.js + bin/dev.js 事件回调）
- **Correction**: implementation-plan 类型化难点补——递归函数需显式返回类型；事件回调解构需事件 interface

#### F26 — 🟠 验证脚本 import 路径在 P-TM06 后断裂（high）→ 已修

- **Evidence**: baseline 脚本 `/tmp/wr-gen-baseline.mjs` 写 `import build from '.../src/index.js'`；P-TM06 改 `src/index.js→src/index.ts`
- **Broken**: P-TM06 + P-TM08 验证脚本 `import src/index.js` → Node native ESM 找不到 `.js`（已改 `.ts`）→ 崩溃
- **Root cause**: 验证流程直跑 `src/index.js` 的 build 函数（非 dist）；迁移后 index.js 不存在
- **Correction**: validation V-TM06/V-TM08 验证脚本改 `import src/index.ts` + `node --experimental-strip-types`；V-TM00 baseline 加注意标注

### R7 verdict

**pass-with-findings** —— F26（high 验证脚本断裂，已修）+ F24/F25（medium 难点，已修）。验证流程 + 类型化难点已落盘。可授权实施。

## 13. R8 review（2026-09-16，类型化难点深挖）

### R8 findings

#### F27 — 🟡 TS2345/2322/2314 类型不兼容 + 泛型缺失（medium）→ 已修

- **Evidence**:
  - **TS2345/2322 类型不兼容**：
    - `string | null` → `string`（emit.js:90, style/index.js:57）——需 null 检查或断言
    - `string` → `Platform | undefined`（emit.js:53/121）——需字面量联合或断言
    - `TransformOptions` 形状不匹配（logic/index.js:381，esbuild loader）——需适配第三方类型
    - `WxmlRenderer` 形状不匹配（view/index.js:44，meta.backend/lineOrigins）——需补全 WxmlRenderer interface 字段
    - `CompilerOptions` 形状不匹配（view/index.js:546，vue compiler）——需适配 vue 类型
    - 函数签名不兼容（build-pipeline.js:218，runOptions vs object）——需精确函数签名
  - **TS2314 泛型缺失**：
    - `Map<K,V>` 需 2 参数（npm-builder.js:246）
    - `Array<T>`/`Set<T>` 需 1 参数（view/index.js:619/869）
- **Broken**: F25 只提递归函数 + 事件解构，未覆盖类型不兼容 + 泛型缺失
- **Correction**: implementation-plan 类型化难点补——TS2345/2322 类型不兼容（null/字面量联合/第三方形状）+ TS2314 泛型缺失（Map/Array/Set 类型参数）

#### F28 — 🟢 strip-types 递归 import 链全支持（验证通过）

- **Evidence**: POC 验证 Node 22.22 `--experimental-strip-types`：
  - `.ts → .ts` import 链递归 ✓
  - `import type` ✓
  - interface / union / generics ✓
- **Conclusion**: F26 修正方案（V-TM06/V-TM08 strip-types）可行

### R8 verdict

**pass-with-findings** —— F27（medium，类型化难点扩展，已修）+ F28（🟢 strip-types 验证通过）。F27 是 F25 的补充——类型不兼容和泛型缺失需逐个适配。可授权实施。

## 14. R9 review（2026-09-16，dist 字节保证 POC + 错误量验证）

### R9 findings

#### F29 — 🟢 dist 字节保证 POC 通过（验证）

- **Evidence**: `art.js`（0 错误，无 @typedef）改名 `art.ts` → `tsc build` → dist 字节对比：
  - `.js` 编译 dist md5: `09f96fc0a7b42351839212cb7e36045b`
  - `.ts` 改名编译 dist md5: `09f96fc0a7b42351839212cb7e36045b`
  - ✅ 完全相同
- **Conclusion**: `.js→.ts` 改名（无类型注解）dist 字节不变。加类型注解后 tsc erase 类型，dist 仍同。**行为 0 全程基础保证**。

#### F30 — 🟢 错误量统计验证（无 finding）

- **Evidence**: R2 完整路径统计正确（env.js 103 最高，session/index.js = 34）；basename grep（session+bin index.js 合计 315）是验证方法 bug，不影响 R2 数据
- **Conclusion**: 1134 错误分布确认无误

### 错误量分布确认（1134 总）

| 文件 | 错误 | 阶段 |
| --- | --- | --- |
| core/env.js | 103 | P-TM02 |
| view/index.js | 101 | P-TM05 |
| napi/parse.js | 91 | P-TM05 |
| style/index.js | 86 | P-TM05 |
| logic/index.js | 59 | P-TM05 |
| shared/utils.js | 45 | P-TM02 |
| compatibility.js | 38 | P-TM03 |
| compile-cache.js | 34 | P-TM04 |
| session/index.js | 34 | P-TM04 |

### R9 verdict

**pass** —— F29/F30 全验证通过，无新 finding。dist 字节保证 POC 确认行为 0 基础。ready gate 最终 pass，可授权实施。

## 15. R10 review（2026-09-16，P-TM01 import 清单补全 + type-only/vitest 验证）

### R10 findings

#### F31 — 🟡 P-TM01 import 修正清单不全（medium）→ 已修

- **Evidence**: F24 只列 document.js 的 9 处 import 方，缺：
  - `document-ops.js`：9 处（tools/index/load×3/cheerio/napi/view + 3 __tests__）
  - `emit.js`：2 处（logic/index.js + view/index.js）
  - `napi/parse.js`：1 处（view/wxml/parse.js）
- **Broken**: P-TM01 共需改 21 处 import 后缀（document 9 + document-ops 9 + emit 2 + napi-parse 1），F24 只列 9
- **Correction**: implementation-plan P-TM01 补全 document-ops/emit/napi-parse import 清单（21 处）

#### F32 — 🟢 type-only import .ts 显式后缀 dist rewrite（验证通过）

- **Evidence**: POC `compile-target.ts` import type `'./compile-target.types.ts'` → dist `compile-target.js` 无 types import 行（tsc 正确 erase type-only）
- **Conclusion**: type-only import .ts 显式后缀，tsc erase + dist 无残留 ✓

#### F33 — 🟢 vitest .ts transform（验证通过）

- **Evidence**: 无 vitest.config（默认 vite transform）；现状 .ts 文件（parity/registry/compile-target）vitest 跑通 584/584
- **Conclusion**: vitest 无需 config 调整，.ts transform 默认支持 ✓

### R10 verdict

**pass-with-findings** —— F31（medium，import 清单补全，已修）+ F32/F33（🟢 验证通过）。P-TM01 共 21 处 import 修正已全列。可授权实施。

## 16. R11 review（2026-09-16，跨阶段 import 工作量 + worker-entry 链依赖）

### R11 findings

#### F34 — 🟡 跨阶段 import 后缀修正工作量未量化（medium）→ 已修

- **Evidence**: P-TM02 shared/ 35 处（utils 11 + lifecycle 7 + compile-config 6 + path-utils 5 + platforms 3 + compile-progress 2 + art 1）+ P-TM03 worker-runtime 16 处（context 5 + runtime 3 + loggers 3 + define-engine 3 + sinks 1 + executor 1）
- **Broken**: implementation-plan 只说"grep 所有 import 方改后缀"，没量化每阶段工作量
- **Correction**: implementation-plan 补跨阶段 import 修正工作量表（P-TM01 21 + P-TM02 35 + P-TM03 16+ + ...）

#### F35 — 🟡 worker-entry 链跨阶段依赖未提（medium）→ 已修

- **Evidence**: 3 个 `worker-entry.js`（view/logic/style）各 import `'../worker-runtime/runtime.js'`（P-TM03）+ `'./index.js'`（P-TM05）。P-TM03 改 runtime.ts 时，worker-entry.js（还 .js）的 import 要跨阶段改 .ts
- **Broken**: plan 没提 worker-entry 跨阶段依赖（P-TM03 碰 worker-entry import，P-TM05 再碰）
- **Correction**: implementation-plan 补 worker-entry 跨阶段依赖说明（P-TM03 改 runtime import 后缀；P-TM05 改 worker-entry .ts + index import 后缀）

#### F36 — 🟢 P-TM08 最终 tsc --noEmit 验证（验证通过）

- **Evidence**: 现状 `tsc --noEmit`（非 checkJs）= 0 错误（.ts 已类型完善，.js 不检查）。全量 .ts 后 tsc strict 0 错误是 P-TM08 验证点。
- **Conclusion**: P-TM08 `tsc --noEmit` 0 错误作为最终 tsc 验证 ✓

### R11 verdict

**pass-with-findings** —— F34/F35（medium，工作量 + 跨阶段依赖，已修）+ F36（🟢 验证通过）。跨阶段 import 修正工作量 + worker-entry 依赖已落盘。可授权实施。

## 17. R12 review（2026-09-16，TS2554 参数数量 + maxNodeModuleJsDepth + env.js FileTypes）

### R12 findings

#### F37 — 🟡 TS2554 参数数量不匹配新类别（medium）→ 已修

- **Evidence**: 3 处 TS2554：
  - `env.js:369` `storeComponentConfig(configInfo.appInfo, appFilePath)`——签名/调用参数数不符
  - `watch-plan.js:37` Expected 0 got 1
  - `watch-plan.js:42` Expected 0 got 2
- **Broken**: F27 类型化难点只提类型不兼容 + 泛型缺失，未提参数数量不匹配（真实调用错误，非加 `:type` 可解，需修正签名或调用）
- **Correction**: implementation-plan 类型化难点补 TS2554（参数数量修正——核对函数签名与调用）

#### F38 — 🟢 maxNodeModuleJsDepth:0 影响（验证通过）

- **Evidence**: `tsconfig.json` `maxNodeModuleJsDepth: 0`——限制 tsc 不深入 node_modules .js 类型解析
- **Impact**: listr2/cheerio 有 .d.ts 不受影响；mitt 无 .d.ts → 类型 any（用量少可控）
- **Conclusion**: 无需调整，mitt 局部 type 声明兜底 ✓

#### F39 — 🟢 env.js FileTypes 形状清晰（验证通过）

- **Evidence**: `normalizeFileTypes(fileTypes = {})` 参数默认 `{}` → `ft.template` 访问报 TS2339。形状 `{ template?: string[], style?: string[], viewScript?: string[] }` 清晰
- **Correction**: 定义 `FileTypes` interface + 参数注解 `fileTypes: FileTypes = {}` → TS2339 链式消除 ✓

### R12 verdict

**pass-with-findings** —— F37（medium，TS2554 新类别，已修）+ F38/F39（🟢 验证通过）。F37 是 F27 的补充——参数数量不匹配需修正调用/签名。可授权实施。

## 18. R13 review（2026-09-16，build 流程 + dist 跟踪 + 提交策略）

### R13 findings

#### F40 — 🟢 package.json exports + postbuild 不受影响（验证通过）

- **Evidence**: package.json exports 全指向 `./dist/*.js`（index/bin/watch/session/view/logic/style-compiler）；postbuild `check-package-exports.js` dynamic import dist/.js 验证
- **Impact**: .ts 迁移后 dist 全 .js（tsc 编译），exports 不变，postbuild 验证 dist/.js 可 import
- **Conclusion**: build 流程不受影响 ✓

#### F41 — 🟢 dist 在 .gitignore（验证通过）

- **Evidence**: `.gitignore` 含 `dist`——dist 不提交
- **Conclusion**: 迁移不影响 git 跟踪的 dist ✓

#### F42 — 🟢 baseline 4 组产物已删（验证）

- **Evidence**: `/tmp/wr-baseline-*` 不存在（worker-runtime 实施后清理）
- **Impact**: P-TM00 需重新生成 baseline（V-TM00 已列脚本）
- **Conclusion**: V-TM00 baseline 脚本完整，无遗漏 ✓

#### F43 — 🟢 实施提交策略未提（low）→ 已修

- **Evidence**: implementation-plan 没提提交粒度
- **Correction**: implementation-plan 补提交策略——每 P-TM 一步独立 commit（先例 worker-runtime P-WR00..08）

### R13 verdict

**pass-with-findings** —— F40/F41/F42（🟢 build 流程验证通过）+ F43（low 提交策略，已修）。build 流程不受影响。可授权实施。

## 19. R14 review（2026-09-16，P-TM01 核心可行性 POC）

### R14 POC

`document.js → document.ts` + `@typedef → type`（Span/Document/Value/Attr）+ `wxml-ir.types.ts`/`parity.ts` import `.ts` 后缀 → `tsc --noEmit`：
- **TS2305 清零**（0 个）——@typedef→type 后类型 resolve 成功
- `document.ts` 拋留 TS7006（raw/name/record 隐式 any）——P-TM01 预期残留（P-TM02..05 处理，符合 F19）
- `document-ops.js` TS2353（对象字面量属性 'name'）——@typedef→type 后类型检查渗透

### R14 findings

#### F44 — 🟢 P-TM01 核心可行性 POC 验证通过

- **Evidence**: `document.js→document.ts` + `@typedef→type`（Span/Document/Value/Attr）+ `wxml-ir.types.ts`/`parity.ts` import `.ts` 后缀 → `tsc --noEmit` **TS2305 清零**（0 个）
- **Conclusion**: @typedef→type 后类型 resolve 成功，P-TM01 核心可行性验证通过 ✓

#### F45 — 🟡 document-ops.js TS2353 类型检查渗透（medium）→ 已纳入 scope

- **Evidence**: POC 后 `document-ops.js:484` 报 TS2353（对象字面量属性 'name' 不存在于类型）——@typedef→type 后 .js 文件 import 类型触发对象字面量检查变严
- **Broken**: P-TM01 改 document.ts 后，document-ops.js（还 .js）import document 类型可能触发 TS2353 链式
- **Correction**: P-TM01 要同步处理 document-ops 的 @typedef→type + 对象字面量类型修正（document-ops 在 P-TM01 scope，已含）

### R14 verdict

**pass-with-findings** —— F44（🟢 P-TM01 核心可行性验证通过）+ F45（medium，TS2353 类型渗透，P-TM01 scope 内）。P-TM01 @typedef→type 路径验证可行。可授权实施。

## 20. R15 review（2026-09-16，__tests__ 修正量 + engine 契约 + helpers）

### R15 findings

#### F46 — 🟡 __tests__ import 修正量未量化（medium）→ 已修

- **Evidence**: `grep -rl "from '.*src/.*\.js'" __tests__/` = **61 个测试文件 100 处 import**
- **Broken**: D-TM-2 只说"__tests__ import .js→.ts 同步改"，P-TM07 工作量被低估（61 文件 100 处）
- **Correction**: implementation-plan P-TM07 补工作量（61 文件 100 处 import）

#### F47 — 🟡 helpers/run-with-abilities.js 状态未定（medium）→ 已修

- **Evidence**: `__tests__/helpers/run-with-abilities.js` import context.js/sinks.js/loggers.js（worker-runtime 3 文件）；14 个测试 import helpers
- **Broken**: P-TM03 改 worker-runtime .ts 后，helpers 的 import 要改 .ts 后缀（helpers 本身 .js 保持——Non-goals 不改测试逻辑）
- **Correction**: implementation-plan 补 helpers 说明——helpers 保持 .js，import 后缀随 P-TM03 改 .ts

#### F48 — 🟢 engine 契约类型形状清晰（验证通过）

- **Evidence**: `defineEngine` 返回 `{ name, buildConfig: msg => ..., cleanup, successPayload: ({logger}) => ..., normalizeError: e => ..., ...overrides }`——D-WR 契约形状明确
- **Conclusion**: P-TM03 类型化直接用 D-WR 契约形状 ✓

### R15 verdict

**pass-with-findings** —— F46/F47（medium，__tests__ 修正量 + helpers 状态，已修）+ F48（🟢 engine 契约清晰）。P-TM07 工作量 61 文件 100 处已量化。可授权实施。

## 21. R16 review（2026-09-16，ENTRY_PATH 动态后缀 + 一致性复查）

### R16 findings

#### F49 — 🟠 executor.js ENTRY_PATH 硬编码 .js 后缀（high）→ 已修

- **Evidence**: `executor.js` `const ENTRY_PATH = { view: '../view/worker-entry.js', logic: '../logic/worker-entry.js', style: '../style/worker-entry.js' }`
- **Broken**:
  - P-TM05 改 worker-entry.js→.ts 后，`/src/` 跑 `new Worker(ENTRY_PATH[script])` 找不到 `.js`（已改 .ts）→ 崩
  - tsc `rewriteRelativeImportExtensions` 只 rewrite import 语句，**不 rewrite 字符串字面量**——ENTRY_PATH 是变量值，dist 保持源码后缀
  - 源码改 `.ts` → dist 也 `.ts` → dist new Worker 找不到 `.ts`（dist 是 .js）→ 崩
- **Root cause**: worker-entry 路径是字符串字面量，非 import 语句，不受 tsc rewrite 保护
- **Correction**: P-TM05 改 worker-entry .ts 时，executor.js ENTRY_PATH 需**动态后缀**（用现有 `/src/` 判断模式，D-TD-20）：
  ```js
  const isSrc = import.meta.url.includes('/src/')
  const EXT = isSrc ? '.ts' : '.js'
  const ENTRY_PATH = { view: `../view/worker-entry${EXT}`, logic: `../logic/worker-entry${EXT}`, style: `../style/worker-entry${EXT}` }
  ```
  - `/src/` 跑：`new Worker('.../worker-entry.ts')` + strip-types ✓
  - dist 跑：`new Worker('.../worker-entry.js')` ✓

#### F50 — 🟢 一致性复查（验证通过）

- acceptance A-TM0..5 全 pending ✓
- validation V-TM00..08 全段落 ✓
- research §6-20 R1-R15 完整 ✓

### R16 verdict

**pass-with-findings** —— F49（high，ENTRY_PATH 动态后缀，已修）+ F50（🟢 一致性通过）。F49 是 P-TM05 的关键实施点。可授权实施。

## 22. R17 review（2026-09-16，executor→worker-pool 跨阶段依赖 + view/index.js 构成）

### R17 findings

#### F51 — 🟡 executor→worker-pool 跨阶段依赖未列（medium）→ 已修

- **Evidence**: `executor.js:2` `import { workerPool } from '../../watch/worker-pool.js'`——worker-pool.js 只被 executor.js import（1 处）
- **Broken**: F35 只提 worker-entry 链跨阶段依赖（P-TM03 碰 worker-entry），没提 executor→worker-pool（P-TM04 改 watch/worker-pool.ts 时，executor.js 已改 .ts 的 import 后缀要改 .ts）
- **Correction**: F34 工作量表 P-TM04 补 executor→worker-pool（1 处）

#### F52 — 🟢 view/index.js 101 错构成清晰（验证通过）

- **Evidence**: TS7006 隐式 any 参数 39 + TS2339 property 17 + TS18046 9 + TS2314 泛型 8 + 其他——隐式 any 为主
- **Conclusion**: P-TM05 类型化 view/index.js 机械可解（:type 为主）✓

### R17 verdict

**pass-with-findings** —— F51（medium，executor→worker-pool 跨阶段依赖，已修）+ F52（🟢 验证通过）。F51 是 F34 工作量的补充。可授权实施。

## 23. R18 review（2026-09-16，worker-pool 契约 + tsconfig include + session 构成）

### R18 findings

#### F53 — 🟢 worker-pool.js WorkerPool 契约清晰（验证通过）

- **Evidence**: `class WorkerPool { async runWorker(workerCreator) {...} getWorkerOptions() {...} }`——executor.js 用 `workerPool.runWorker(creator)` + `workerPool.getWorkerOptions()`
- **Conclusion**: P-TM04 类型化 worker-pool 契约清晰（runWorker 收 creator 函数，getWorkerOptions 返回 worker 选项）✓

#### F54 — 🟡 tsconfig include "src/**/*.js" 迁移后空模式（low）→ 已修

- **Evidence**: `tsconfig.build.json` include `"src/**/*.js" + "src/**/*.ts"`——全 .ts 后 .js 模式无匹配（空 glob 合法，tsc 不报错但冗余）
- **Correction**: P-TM08 可清理为只 `"src/**/*.ts"`（可选，非必需）

#### F55 — 🟢 session/index.js 34 错构成（验证通过）

- **Evidence**: TS2339 property any 21 + TS7006 隐式 any 4 + TS7019 3 + TS2556 spread 3 + 其他
- **Conclusion**: TS2339 为主——session 动态配置对象需 interface；TS7019/TS2556 少量 spread 修正 ✓

### R18 verdict

**pass-with-findings** —— F54（low，tsconfig include 清理可选，已修）+ F53/F55（🟢 验证通过）。无新 blocker。可授权实施。

## 24. R19 review（2026-09-16，剩余大文件错构成验证）

### R19 findings

#### F56 — 🟢 src/ 根 2 文件确认（验证通过）

- **Evidence**: `src/index.js` + `src/watch.js`（P-TM06 改名 .ts）；src/ 根无其他非 .js/.ts 文件（无遗漏）
- **Conclusion**: 72 文件清单完整 ✓

#### F57 — 🟢 compatibility.js 38 错构清楚（验证通过）

- **Evidence**: TS7006 隐式 any 参数 32（84%）+ TS7034 2 + TS7005 2 + TS7053 1 + TS2353 1
- **Conclusion**: 隐式 any 为主——P-TM03 类型化机械可解（:type）✓

#### F58 — 🟢 compile-cache.js 34 错构清楚（验证通过）

- **Evidence**: TS7006 隐式 any 参数 28（82%）+ TS7031 3 + TS7053 1 + TS7034 1 + TS7005 1
- **Conclusion**: 隐式 any 为主——P-TM04 类型化机械可解 ✓

#### F59 — 🟢 env.js FileTypes 路径确认（验证通过）

- **Evidence**: `normalizeFileTypes(fileTypes = {})` → 定义 `FileTypes` interface（`{ template?, style?, viewScript? }`）+ 参数注解 → TS2339 链式消除（R12 F39）
- **Conclusion**: P-TM02 env.js 103 错路径清晰 ✓

### R19 verdict

**pass** —— F56-F59 全验证通过，无新 finding。compatibility/compile-cache 都是隐式 any 为主（机械可解）。可授权实施。

## 25. R20 review（2026-09-16，style/index.js 语法错误验证）

### R20 findings

#### F60 — 🟢 style/index.js 6 个语法错误是 checkJs 误报（验证通过）

- **Evidence**:
  - TS1005/TS1141/TS2300 报在 513,29/40 + 515,75/86——都是 **JSDoc 注释行**（`@import statements`）
  - tsc 把 .js 注释里的 `@import` 误解为 import 语句（checkJs/allowJs 解析 bug）
  - POC：同注释的 `.ts` 文件 → `tsc --noEmit` **退出码 0**（不报错）
- **Conclusion**: 迁移 .ts 后这 6 个语法错误**自然消除**——非真实问题 ✓
- **Impact**: style/index.js 86 错中 6 个是 .js 注释误报（.ts 后消失），剩 80 个真实类型错误（TS7006 隐式 any 为主，机械可解）

### R20 verdict

**pass** —— F60（🟢 checkJs 误报验证）。无新 blocker。可授权实施。

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
