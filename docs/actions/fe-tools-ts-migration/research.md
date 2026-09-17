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
