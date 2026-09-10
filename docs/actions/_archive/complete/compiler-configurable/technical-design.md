# Technical Design — compiler-configurable

> 契约状态：**已冻结（v1，2026-09-10）**。Readiness Review verdict `pass`：D-CF1-1..4 全按建议。实施在 CF-4 complete 之后；变更需同步 requirements / acceptance / README。

设计基线（2026-09-10）：

| 位点 | 现状 |
| --- | --- |
| `logic-compiler` bundle minify | `minify: true`, `target: ['es2023']` |
| `logic-compiler` 单模块 CJS transform | `target: 'es2020'`（sourcemap 时跳过最终 bundle minify） |
| `view-compiler` esbuild | `minify: true`, `target: ['es2020']` |
| `style-compiler` | `minify: true`（无 JS esTarget） |
| CLI | `--sourcemap`；无 minify flag |
| watch | `createBuildWatcher({ options })` 透传（CF-4） |

## 0. 冻结决策（D-CF1-1..4）

| ID | 决策点 | 冻结值 |
| --- | --- | --- |
| D-CF1-1 | 非法 `esTarget`（顶层标量、非对象等） | **硬失败**；缺字段填缺省；未知键硬失败 |
| D-CF1-2 | mode 字段 | `options.mode`: `'build' \| 'dev'`（缺省 build） |
| D-CF1-3 | logic 单模块 CJS `es2020` | **本门不接线**；归 CF-3 同车道收敛 |
| D-CF1-4 | Acceptance / 消融 | A-001..A-009 采纳；A-006 须可消融 |

## 1. 配置结构

```js
// fe/packages/compiler/src/common/compile-config.js
{
  mode: 'build' | 'dev',
  platform: 'native' | 'web' | undefined, // CF-1 占位；语义 CF-2
  minify: boolean,
  sourcemap: boolean,
  esTarget: {
    logic: string, // 缺省 'es2023'
    view: string,  // 缺省 'es2020'
  },
}
```

**禁止**顶层标量 `esTarget`。非法形状（标量、非对象、未知键）合并期 **硬失败**（D-CF1-1）；`logic`/`view` 缺字段填内部缺省。

## 2. 合并链

```text
内部缺省
  ← platform defaults（CF-1：空操作；CF-2 填充）
  ← mode preset（build: minify=true；dev: minify=false）
  ← API options / createBuildWatcher.options
  ← CLI flags（最高）
```

`resolveCompileConfig({ mode, cli, apiOptions }) → config`。

`build()`：从 `options` 取出已识别字段合并进 config，余下 options（stages、lifecycle、seedPath…）行为不变。

## 3. stage 接线

| 消费方 | 读取 |
| --- | --- |
| logic bundle minify (`transform` 合并 modDefine) | `config.minify`（及 sourcemap 跳过规则）、`config.esTarget.logic` |
| logic 单模块 CJS | **本门保持现状硬编码 `es2020`**（标注 `// CF-3: esTarget.logic`）；不在本门改为 es2023，以保证 R-006 |
| view esbuild | `config.minify`、`config.esTarget.view` |
| style | `config.minify` only |

sourcemap 跳过最终 minify：保留现逻辑，改为显式 `effectiveMinify = config.minify && !config.sourcemap`（或等价），注释说明理由。

## 4. CLI（bin，CF-4 之后）

- `dmcc build`：`--minify` / `--no-minify`；默认 mode=build
- `dmcc dev`：`--minify` / `--no-minify`；默认 mode=dev（minify=false）
- `--sourcemap` 写入 `config.sourcemap`
- **首版不暴露** `--es-target-*` CLI（克制）；API/options 可设 `esTarget`

`createBuildWatcher({ options })`：调用方传入已含 minify/sourcemap/esTarget 的 options；runner 不解析 profile。

mode 注入：`build()` 缺省 `mode: 'build'`；`dmcc dev` / watcher 传入 `options.mode: 'dev'`（D-CF1-2）。

## 5. 文件落地

新增：

- `src/common/compile-config.js`
- `__tests__/compile-config.spec.js`（合并链、双字段、拒绝标量、mode minify 缺省）

修改：

- `src/index.js` — resolve + 下发
- `src/core/logic-compiler.js` / `view-compiler.js` / `style-compiler.js`
- `src/bin/index.js` / `dev.js` — minify flags + mode=dev
- worker 消息若携带编译选项，需包含 config 切片（与现 sourcemap 下发方式对齐）

## 6. 与 CF-2 / CF-3

- **CF-2**：填充 `platform` 枚举与 defaults（如 view 覆盖）；本门占位
- **CF-3**：logic 单模块 CJS → `esTarget.logic`；可选抬升 `esTarget.view` + WebView 矩阵

## 7. 备选与取舍

- **全局单一 esTarget**：与双线程冲突；已弃（2026-09-10）
- **CF-1 即把 CJS 改为 esTarget.logic=es2023**：缺省 diff≠0，与 R-006 冲突；推迟 CF-3
- **minify 仅 API 不暴露 CLI**：违反「可配置能力 CLI⊆API」中「要暴露的能力须双侧」；本门选择暴露 minify CLI
