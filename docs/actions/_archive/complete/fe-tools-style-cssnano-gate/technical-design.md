# Technical Design — fe-tools-style-cssnano-gate

Status: **ready（2026-10-07）**

权威参考：[Experience-Review.md](../../../../Experience-Review.md) · [style-minify-gate](../fe-tools-style-minify-gate/README.md)

## 1. 现状代码

### parse-walk.ts（cssnano loader + PostCSS pipeline）

```typescript
// cssnano loader（line 42-48）— 定义在 parse-walk
let cssnanoLoader: Promise<typeof import('cssnano')['default']> | undefined

function loadCssnano() {
    cssnanoLoader ||= import('cssnano').then(module => module.default)
    return cssnanoLoader
}

// sourcemap=true 路径（line 381-389）— cssnano 加入 PostCSS pipeline
if (options.sourcemap) {
    if (shouldMinify) {
        const cssnano = await loadCssnano()
        postcssPlugins.push(cssnano() as unknown as postcss.Plugin)
    }
    finalResult = await postcss(postcssPlugins).process(scopedResult.code, {
        from: undefined,
        map: getPostcssMapOptions(true, scopedResult.map),
    })
}
```

### emit.ts（style-minify-gate 后的状态）

```typescript
// isDiffVerifyMode + minifyCss 已定义在此（正本）
export function isDiffVerifyMode(): boolean { ... }
export async function minifyCss(css: string): Promise<string> { ... }

// emitStyle — sourcemap=false 路径已 gate
export async function emitStyle(modules, options) {
    if (options.minify && !sourcemap && !isDiffVerifyMode()) {
        code = await minifyCss(code)  // esbuild（sourcemap=false canonical）
    }
    // sourcemap=true 路径：无 minify（cssnano 还在 parse-walk）
}
```

## 2. 设计 — cssnano gate + 代码归置

### D-CN-1: cssnano loader 迁到 emit 侧

`loadCssnano()` + `cssnanoLoader` 从 parse-walk.ts 迁到 emit.ts（正本）：

```typescript
// style/emit.ts — 正本
let cssnanoLoader: Promise<typeof import('cssnano')['default']> | undefined

export function loadCssnano() {
    cssnanoLoader ||= import('cssnano').then(module => module.default)
    return cssnanoLoader
}
```

```typescript
// style/parse-walk.ts — legacy fallback 借用正本
import { minifyCss, isDiffVerifyMode, loadCssnano } from './emit.ts'
```

依据：R-CN-2。emit 拥有 minify 逻辑。

### D-CN-2: parse-walk gate（legacy fallback）

sourcemap=true 路径 cssnano 调用加 `isDiffVerifyMode()` gate：

```typescript
if (options.sourcemap) {
    if (shouldMinify && isDiffVerifyMode()) {  // ← 加 gate
        const cssnano = await loadCssnano()
        postcssPlugins.push(cssnano() as unknown as postcss.Plugin)
    }
    finalResult = await postcss(postcssPlugins).process(scopedResult.code, {
        from: undefined,
        map: getPostcssMapOptions(true, scopedResult.map),
    })
}
```

依据：R-CN-1。验证模式（isDiffVerifyMode()=true）保留现状；生产模式（false）不加 cssnano。

### D-CN-3: emitStyle cssnano canonical path

`emitStyle` 加 cssnano canonical path（sourcemap=true 路径）：

```typescript
// style/emit.ts — emitStyle 内

// sourcemap=true + minify + 生产模式 → cssnano 在 emit
if (options.minify && sourcemap && !isDiffVerifyMode() && module.map) {
    const cssnano = await loadCssnano()
    const postcssResult = await postcss([cssnano()]).process(code, {
        from: undefined,
        map: { prev: module.map, inline: false, annotation: false, sourcesContent: true },
    })
    code = postcssResult.css
    map = postcssResult.map.toString()  // ← 更新 sourcemap
}

// sourcemap=false + minify + 生产模式 → minifyCss esbuild（已有）
if (options.minify && !sourcemap && !isDiffVerifyMode()) {
    code = await minifyCss(code)
}
```

依据：R-CN-1。`sourcemap && module.map` 守卫确保有 sourcemap 时才跑 cssnano（与 minifyCss 的 `!sourcemap` 守卫互补）。

`annotation: false` 守卫：PostCSS `annotation` 默认 `true` 会向 CSS 追加 `/*# sourceMappingURL=to.css.map */`，与 emitStyle 手动追加的 sourceMappingURL重复 → 设 `false` 避免重复。

`sourcesContent: true`：保留 sourcesContent（`style-sourcemap.spec.js` 断言 `map.sourcesContent`）。

`module` 是 `const`，不可重新赋值。引入 `let map = module.map` 作为独立变量，cssnano 更新后赋值 `map = postcssResult.map.toString()`，后续 sourcemap 处理块读 `map` 而非 `module.map`。

### D-CN-4: per-module vs aggregated

验证模式：cssnano 在 parse-walk PostCSS pipeline，per-module（每个 `buildCompileCss` 递归调用各自跑 cssnano）。

生产模式：cssnano 在 emit，aggregated（对整个 `module.code` 一次跑）。

产出字节可能不同（per-module 保留模块间 `\n`，aggregated 删除），与 D-SM-4 同理。两种模式产出均为有效 minified CSS + 有效 sourcemap。

依据：R-CN-5 不改 cssnano 配置；Non-scope 明确不要求字节一致。

### D-CN-5: sourcemap chain 正确性

验证模式：cssnano 在 PostCSS pipeline 内，sourcemap 自然链入（external-class → autoprefixer → cssnano 同一次 PostCSS 解析）。

生产模式：cssnano 在 emit 单独跑 PostCSS，`map: { prev: module.map }` 将 parse-walk 的 sourcemap 作为前驱 → 新 sourcemap 链：original source → parse-walk transforms → emit cssnano → minified CSS。

`style-sourcemap.spec.js` 断言 `map.sources` + `map.sourcesContent` + `SourceMapConsumer` mappings → 这些在两种模式下均应正确（sources/sourcesContent 不受 cssnano 位置影响）。

## 3. 不改什么

- cssnano 调用方式（`cssnano()` 无参数）。
- external-class / autoprefixer 逻辑。
- `minifyCss` 函数 + `isDiffVerifyMode` 函数（style-minify-gate 已定）。
- `StyleOptions` / `StyleEmitOptions` 接口签名。
- `getPostcssMapOptions`（parse-walk 内，不被 emit 使用）。
- logic / view 车道。

## 4. 交付物

| 文件 | 变更 |
|---|---|
| `style/emit.ts` | 加 `import postcss from 'postcss'`；迁 `loadCssnano()` + `cssnanoLoader`（从 parse-walk 迁来）；`emitStyle` 加 cssnano canonical path（sourcemap=true；`annotation: false` 守卫 + `let map` 独立变量） |
| `style/parse-walk.ts` | 删 `loadCssnano` + `cssnanoLoader` 定义；import 改为 `from './emit.ts'`；cssnano 调用加 `isDiffVerifyMode()` gate |

## 5. 验收映射

| 设计 | 需求 | 验收 |
|---|---|---|
| D-CN-1 loader 迁 emit | R-CN-2 | A-CN2 |
| D-CN-2 parse-walk gate | R-CN-1 | A-CN1 |
| D-CN-3 emitStyle cssnano | R-CN-1 | A-CN1 |
| D-CN-5 sourcemap chain | R-CN-4 | A-CN4 |
| 不改 cssnano 配置 | R-CN-5 | A-CN5 |
| 验证模式 diff=0 | R-CN-3 | A-CN3 |
