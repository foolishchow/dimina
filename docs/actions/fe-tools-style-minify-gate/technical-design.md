# Technical Design — fe-tools-style-minify-gate

Status: **draft（2026-10-07）**

权威参考：[Experience-Review.md](../../Experience-Review.md) · [emit-transform-split](../_archive/complete/fe-tools-emit-transform-split/README.md)

## 1. 现状代码

### parse-walk.ts（minifyCss 调用点）

```typescript
// sourcemap=false 路径（line ~392-396）
const prefixedResult = await postcss(postcssPlugins).process(scopedResult.code, { from: undefined })
if (shouldMinify) {
    const minifiedCode = await minifyCss(prefixedResult.css)
    finalResult = { css: minifiedCode, map: null }
}
else {
    finalResult = { css: prefixedResult.css, map: null }
}
```

### emit.ts（minifyCss 定义 + 死参数）

```typescript
// minifyCss 定义（line 8-16）
export async function minifyCss(css: string): Promise<string> { ... }

// emitStyle（line 28-55）—— minify 参数传入但不用
export async function emitStyle(modules, options: StyleEmitOptions): Promise<EmitEntry> {
    // 只做 package，不 minify
}
```

### index.ts（compileSS 传参）

```typescript
const entry = await emitStyle(
    [{ moduleId: page.path, code: result.code, map: result.map }],
    { ..., minify: options.minify !== false },
)
```

## 2. 设计 — env var gate

### D-SM-1: env var 读取

```typescript
// 定义在 style/emit.ts（parse-walk.ts 已有 import 路径，不新增依赖方向）
function isDiffVerifyMode(): boolean {
    return !!process.env.DIMINA_COMPILER_DIFF_VERIFY
}
```

### D-SM-2: parse-walk gate

sourcemap=false 路径加 gate：

```typescript
if (shouldMinify && isDiffVerifyMode()) {
    // 现状：parse-walk minify
    const minifiedCode = await minifyCss(prefixedResult.css)
    finalResult = { css: minifiedCode, map: null }
}
else {
    // 新路径：不 minify，让 emit 做
    finalResult = { css: prefixedResult.css, map: null }
}
```

依据：R-SM-1。验证模式（isDiffVerifyMode()=true）保留现状；生产模式（false）不 minify。

### D-SM-3: emitStyle 激活

```typescript
export async function emitStyle(modules, options: StyleEmitOptions): Promise<EmitEntry> {
    const module = modules[0]!
    let code = module.code

    // 新路径：生产模式下 emit 做 minify（仅 sourcemap=false——sourcemap=true 路径 cssnano 已在 parse-walk 处理）
    if (options.minify && !options.sourcemap && !isDiffVerifyMode()) {
        code = await minifyCss(code)
    }

    // ... 后续 package 逻辑不变
}
```

依据：R-SM-2。死参数 `minify` 激活。`!options.sourcemap` 守卫确保 sourcemap=true 路径不被双重 minify（cssnano 已在 parse-walk 处理）+ sourcemap 不失效。

### D-SM-4: 产出一致性

验证模式：parse-walk per-module minify → `result.code`（minified）→ emitStyle 不 minify → 产物 = minified。

生产模式：parse-walk 不 minify → `result.code`（unminified）→ emitStyle aggregated minify → 产物 = minified。

同一 `minifyCss` 函数，同一 esbuild 参数。但 per-module minify（验证模式）与 aggregated minify（生产模式）产出字节可能不同（per-module 保留模块间 `\n`，aggregated 删除——见 `emit.ts:6` 注释）。两种模式产出均为有效 minified CSS，但不保证字节一致。

## 3. 不改什么

- `minifyCss` 函数本身不改。
- cssnano（sourcemap=true 路径）不改。
- `StyleOptions` / `StyleEmitOptions` 接口签名不改。
- `index.ts` 传参不改（`minify` 已在传）。
- 不改 logic / view 车道。

## 4. 交付物

| 文件 | 变更 |
|---|---|
| `style/emit.ts` | 加 `isDiffVerifyMode()`（定义在此）+ `emitStyle` 激活 `minify` 参数（`!sourcemap` 守卫） |
| `style/parse-walk.ts` | sourcemap=false 路径 minifyCss 调用加 `isDiffVerifyMode()` gate |

## 5. 验收映射

| 设计 | 需求 | 验收 |
|---|---|---|
| D-SM-1 env var | R-SM-1 | A-SM1 |
| D-SM-2 parse-walk gate | R-SM-1 | A-SM1 |
| D-SM-3 emitStyle 激活 | R-SM-2 | A-SM2 |
| 不改 cssnano | R-SM-4 | A-SM4 |
| 验证模式 diff=0 | R-SM-3 | A-SM3 |
| 生产模式可跑 | R-SM-5 | A-SM5 |
