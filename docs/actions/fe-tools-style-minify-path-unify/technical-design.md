# Technical Design — fe-tools-style-minify-path-unify

Status: **ready（2026-10-09）**

## §1 现状（dual-path 代码位置）

### §1.1 `style/emit.ts`

```typescript
// :11
export function isDiffVerifyMode(): boolean {
	return !!process.env.DIMINA_COMPILER_DIFF_VERIFY
}
// :63  D-CN-3 cssnano（sourcemap=true，production canonical）
if (options.minify && sourcemap && !isDiffVerifyMode() && map) { ... cssnano ... }
// :75  D-SM-3 esbuild（sourcemap=false，production canonical）
if (options.minify && !sourcemap && !isDiffVerifyMode()) { code = await minifyCss(code) }
```

`emitStyle` 接收 `modules: EmitModule[]`，取 `modules[0]!.code`（**已聚合的整 entry CSS**），对聚合体一次 minify = **aggregated**（删模块间 `\n`）。

### §1.2 `style/parse-walk.ts`（:377,390）

```typescript
// :377  cssnano（sourcemap=true，verify legacy）
if (shouldMinify && isDiffVerifyMode()) { postcssPlugins.push(cssnano()) }
// :390  esbuild（sourcemap=false，verify legacy）
if (shouldMinify && isDiffVerifyMode()) {
	const minifiedCode = await minifyCss(prefixedResult.css)  // per-module
	finalResult = { css: minifiedCode, map: null }
}
```

parse-walk per `buildCompileCss` 调用 = **per-module** minify（每个模块独立 minify → join 时保留 `\n`）。

### §1.3 字节差异根因

- per-module：minify 各模块 → join `\n` → 模块间 `\n` 保留
- aggregated：join 所有模块 → 一次 minify → 模块间 `\n` 被删（esbuild/cssnano 压缩跨模块空白）

## §2 target 形状（统一后）

### D-SMPU-1: 字节一致为要求（反转 D-SM-4/D-CN-4 Non-scope）

production 路径须 == baseline（per-module minify + `\n` 保留）。D-SM-4/D-CN-4 的"Non-scope 不要求字节一致"反转。

### D-SMPU-2: 统一路径选 A 还是 B（**locked: 方案 A**）

> **`\n` 保留机制**（empirically confirmed）：esbuild `minifyCss` 输出尾部带 `\n`（实测 `.a{color:red}\n`）。parse-walk `buildCompileCss` per-module minify 后 `.join('')`（:416）——模块间 `\n` 来自各模块 minified code 尾部 `\n`，**非显式 `.join('\\n')`**。这是脆弱不变式：若 esbuild/cssnano 改尾部 `\n` 行为，`\n` 保留破。方案 A/B 均依赖此机制。

#### 方案 A — revert：minify 留 parse-walk（per-module），emit 不 minify

```typescript
// emit.ts：删 :63,75 的 minify 块（emit 不再 minify；StyleEmitOptions.minify 变死参，注释标）
// parse-walk.ts：删 :377,390 的 isDiffVerifyMode() guard（无条件 per-module minify）
//   :390 esbuild（sourcemap=false）：if (shouldMinify) { ... minifyCss ... }
//   :377 cssnano（sourcemap=true）：if (shouldMinify) { postcssPlugins.push(cssnano()) }  ← 也需统一
```

- ✅ 最小改动（parse-walk 已有 per-module minify 逻辑，去 guard 即可）
- ✅ 字节恒等（per-module + `\n` = baseline，已证 verify 路径 diff=0）
- ❌ 放弃 D-SM-2 迁移目标（minify 归 emit——D-SM-2 的设计意图）
- ❌ emit `StyleEmitOptions.minify` 变死参（D-SM-1 前状态）
- ⚠️ **cssnano(sourcemap=true) 也统一到 parse-walk per-module** → `style-sourcemap.spec.js`（现测 emit aggregated，不设 env）输出变——**empirically confirmed**（base 项目 probe：cssnano per-module ≠ aggregated，字节差，同 esbuild）；token-offset 断言 likely 破，需更新期望（per-module `\n` 保留 vs aggregated 删）

#### 方案 B — emit per-module：emit 收 per-module codes，各 minify 后 join `\n`

```typescript
// emit.ts emitStyle：改 minify 逻辑
if (options.minify && !sourcemap) {
	// per-module minify + join 保留 \n（非 aggregated）
	const minified = await Promise.all(modules.map(m => minifyCss(m.code)))
	code = minified.join('\n')
}
```

- ✅ 完成 D-SM-2 迁移（minify 归 emit）
- ✅ 字节恒等（per-module + `\n`）
- ❌ emitStyle 输入 shape 变（需收 per-module codes，非聚合体）——但现状 `modules` 数组只 1 元素（聚合体），需上游 parse-walk 不聚合 + 传 per-module
- ❌ 改动大（parse-walk join 逻辑 + emitStyle 输入 + cssnano per-module 在 emit + map 合并）
- ⚠️ **style-sourcemap.spec.js 同样受影响**（B 也改 cssnano aggregated→per-module，输出变 → token-offset 断言 likely 破，同 A）——该影响 A/B 共享，非 A-specific

**locked A**（最小改动 + 字节恒等已证 + 接受放弃 D-SM-2 迁移——emit 统一 minify 策略在 load/compile 拆时再做）。

### D-SMPU-3: 删 `isDiffVerifyMode` + env var

删 `style/emit.ts:7-12`（`isDiffVerifyMode` 函数 + 注释）+ 所有调用点 guards。删 `DIMINA_COMPILER_DIFF_VERIFY` env var（无 src 引用后即下线）。

### D-SMPU-4: verify 脚本验 production 路径

- `/tmp/verify-*.mjs`：删 `process.env.DIMINA_COMPILER_DIFF_VERIFY = '1'`
- `__tests__/view-style-cache-skip.spec.js` integration：删 `:160` setEnv + `:164` deleteEnv（afterEach 仅留 fs cleanup）

verify 脚本不再设 env → 直接验 production（emit 或 parse-walk，取决于 D-SMPU-2）路径。行为 0 现覆盖 production。

### D-SMPU-5: 行为 0 边界

- one-shot build：production 路径（统一后）== baseline（per-module + `\n`）→ diff=0
- watch：cache-hit re-emit cached code（不变）→ 字节恒等（G5 行为 0 延续）
- production dev/build（bin/）：不再依赖 env → 永走统一路径

## §3 决策

### D-SMPU-1: 字节一致为要求
反转 D-SM-4/D-CN-4 Non-scope。production == baseline（per-module + `\n`）。

### D-SMPU-2: 路径选 A/B（**locked: A**）
A（revert，minify 留 parse-walk）vs B（emit per-module）。**locked A**（最小 + 已证恒等）。

### D-SMPU-3: 删 dual-path + env var
`isDiffVerifyMode` + `DIMINA_COMPILER_DIFF_VERIFY` + 所有 guards。

### D-SMPU-4: verify 验 production
verify 脚本不设 env，直接验 production 路径。

### D-SMPU-5: 行为 0
production 路径 diff=0 对 baseline（6 项目）。

## §4 风险

| 风险 | 缓解 |
| --- | --- |
| 方案 A 放弃 D-SM-2 迁移（emit 统一 minify） | 接受——load/compile 拆时重做；architecture-notes 记 |
| 方案 B 改 emitStyle 输入 shape（per-module codes） | 改动大 + 跨 parse-walk/emit 边界；design gate 评估 |
| 删 env 后 verify 脚本 diff≠0（production ≠ 旧 verify） | 统一后 production == baseline == 旧 verify 路径（per-module + `\n`）→ diff=0 |
| cssnano sourcemap=true 路径 per-module 在 emit 难（PostCSS map 合并） | 方案 A：cssnano 留 parse-walk per-module（不变）；方案 B：需 map 合并逻辑 |
