# Technical Design — platform-abstraction

> 契约状态：**已冻结（v1，2026-09-10）**。Readiness Review verdict `pass`：D-CF2-1..5 全按建议。前置 CF-1 complete。变更需同步 requirements / acceptance / README。

设计基线（2026-09-10，CF-1 已归档）：

| 位点 | 现状 |
| --- | --- |
| `compile-config.js` | `platform` 占位校验 `'native'\|'web'\|undefined`；无缺省填充；无 `sourcemapStrategy` |
| CLI | 无 `--platform`；`dmcc dev` 不注入 platform |
| A4 | `getRenderer` / `registerRenderer`；仅 `webview` |
| 变换 | minify / `esTarget.{logic,view}` 已由 CF-1 驱动；与 platform 无关 |

## 0. 冻结决策（D-CF2-1..5）

| ID | 决策点 | 冻结值 |
| --- | --- | --- |
| D-CF2-1 | 解析与缺省 | 合法值仅 `native`/`web`；未指定 → **`native`**；非法 → `InvalidPlatformError` 硬失败（`build:start` 前） |
| D-CF2-2 | CLI / dev | `dmcc build --platform <name>`；**`dmcc dev` 固定 `platform:'web'`，不暴露 `--platform`**；API `options.platform` 等价 |
| D-CF2-3 | 行为中立 | platform **不**改 minify / esTarget / sourcemap 生成；仅派生 `sourcemapStrategy` 元数据 |
| D-CF2-4 | renderer×platform | `assertRendererSupportsPlatform(renderer, platform)`；webview 全支持；renderer 可挂 `unsupportedPlatforms`（预留 lynx⊄web） |
| D-CF2-5 | Acceptance / 消融 | A-001..A-009；至少对缺省 `native` 或 `platforms` 模块契约做可消融规格 |

## 1. 模块：`platforms.js`

```js
// fe/packages/compiler/src/common/platforms.js
export const PLATFORMS = Object.freeze(['native', 'web'])

export class InvalidPlatformError extends TypeError { /* platform, expected */ }

/** @returns {'native'|'web'} */
export function resolvePlatform(value) {
  if (value === undefined || value === null) return 'native'
  if (value === 'native' || value === 'web') return value
  throw new InvalidPlatformError(value)
}

export function sourcemapStrategyFor(platform) {
  return platform === 'web' ? 'devtools-url' : 'quickjs-attach'
}

/**
 * @param {{ name: string, unsupportedPlatforms?: string[] } | null} renderer
 * @param {'native'|'web'} platform
 */
export function assertRendererSupportsPlatform(renderer, platform) {
  const blocked = renderer?.unsupportedPlatforms
  if (Array.isArray(blocked) && blocked.includes(platform)) {
    throw new InvalidPlatformError(
      platform,
      `renderer ${renderer.name} does not support platform`,
    )
  }
}
```

不新增 package exports 子路径（与 `compile-config` 同为内部模块）。

## 2. 配置结构（相对 CF-1）

```js
{
  mode: 'build' | 'dev',
  platform: 'native' | 'web',           // 解析后必有
  sourcemapStrategy: 'quickjs-attach' | 'devtools-url', // 派生，只读语义
  minify: boolean,
  sourcemap: boolean,
  esTarget: { logic: string, view: string },
}
```

合并链（相对 CF-1 **不变优先级**，填充 platform 缺省）：

```text
内部缺省（含 platform → native）
  ← platform defaults（本门：仅用于派生 sourcemapStrategy；不覆盖 minify/esTarget）
  ← mode preset
  ← API options
  ← CLI flags（最高）
```

`resolveCompileConfig`：用 `resolvePlatform(cli.platform ?? apiOptions.platform ?? input.platform)`；写入 `sourcemapStrategy: sourcemapStrategyFor(platform)`。

## 3. 编排接线

| 位点 | 行为 |
| --- | --- |
| `build()` | 解析 config 后、`build:start` 前：`assertRendererSupportsPlatform(activeRenderer, config.platform)` |
| workers / compilers | **不**因 platform 改变换参数（D-CF2-3） |
| `bin/index.js` | `.option('--platform <name>', ...)` → `buildOptions.platform` |
| `bin/dev.js` | `options: { ..., platform: 'web' }`；无 `--platform` flag |

watch：继续透传 `options`；若 CLI 已写入 platform，rebuild 保持同一 platform。

## 4. D6:B 回写要点（闭合时）

修订 RFC §3 D6：

- **不变层**：modDefine 调用结构、模块 ID、目录布局、`app-config`、兼容性警告语义
- **可变层**：由 compile profile 决定——`esTarget.{logic,view}`、minify、`sourcemap` 开关、以及 **策略标注** `sourcemapStrategy`（本门引入；生成逻辑仍可不变）
- 明确：同一小程序源在不同 platform **声明**下，本门仍保证字节一致（因行为中立）；未来若可变层真正分叉，须按 profile 验收，不再要求跨 platform 字节恒等

## 5. 文件落地

新增：

- `src/common/platforms.js`
- `__tests__/platforms.spec.js`（及/或扩展 `compile-config.spec.js`）

修改：

- `src/common/compile-config.js` — resolvePlatform + sourcemapStrategy
- `src/index.js` — renderer×platform 断言
- `src/bin/index.js` — `--platform`
- `src/bin/dev.js` — 固定 `platform: 'web'`
- 闭合：`docs/Compiler-Architecture-RFC.md` D6:B

## 6. 与相邻门

- **CF-1**：框架已在；本门填充 platform 语义
- **CF-3**：不在本门改 esTarget；不把 platform 绑成「单一全局 esTarget」
- **A4**：只读 `getRenderer`；不改 renderer 注册/选择模型

## 7. 备选与取舍

- **dev 允许 `--platform native`**：否决——与「预览仅 Web 容器」冲突，易误导
- **platform 覆盖 `esTarget.view`**：否决（本门）——双字段已按车道缺省；覆盖属未来显式 profile，且会破坏 diff=0
- **本门就改 sourcemap 生成**：否决——范围膨胀；策略字段先标注
