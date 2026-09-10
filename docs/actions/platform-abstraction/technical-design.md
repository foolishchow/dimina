# Technical Design — platform-abstraction

## 1. 概念边界

```text
源码（WXML/WXSS/JS）
        │
   renderer adapter          ← A4（编译层渲染后端：webview/lynx）
        │
   编译管道（modDefine）
        │
   compile profile           ← 本 Action（platform × mode 编译策略）
        │
        ├─ esTarget     ← platform（运行时能力）
        ├─ minify       ← mode 缺省 + 用户覆盖
        └─ sourcemap    ← platform（策略语义）
```

## 2. Compile profile contract

```js
// src/common/platforms.js

const PLATFORMS = {
  native: {
    name: 'native',
    esTarget: 'es2023',
    sourcemapStrategy: 'quickjs-attach',
  },
  web: {
    name: 'web',
    esTarget: 'es2023',   // 首版与 native 一致；架构支持分叉，值可后续调整
    sourcemapStrategy: 'devtools-url',
  },
}

const MODE_DEFAULTS = {
  build: { minify: true },
  dev:   { minify: false },
}

// 解析优先级：显式配置 > mode 缺省 > platform 缺省
export function resolveCompileProfile({ platform, mode, minify }) {
  const resolvedPlatform = resolvePlatform(platform)  // 缺省 'native'，未知抛 InvalidPlatformError
  const platformDefaults = PLATFORMS[resolvedPlatform]
  const modeDefaults = MODE_DEFAULTS[mode] || {}
  return {
    platform: resolvedPlatform,
    esTarget: platformDefaults.esTarget,
    minify: minify ?? modeDefaults.minify ?? true,
    sourcemapStrategy: platformDefaults.sourcemapStrategy,
  }
}
```

- `esTarget` 仅由 platform 决定（运行时约束，mode 不覆盖）
- `minify` 由 mode 提供缺省、CLI `--minify`/`--no-minify` 显式覆盖
- `sourcemapStrategy` 仅由 platform 决定（首版 web 仅语义标注）

## 3. 硬编码替换

| 位置 | 现状 | 替换后 |
| --- | --- | --- |
| `logic-compiler.js:122` | `target: ['es2023'], minify: true` | `target: [profile.esTarget], minify: profile.minify` |
| `logic-compiler.js:443` | `target: 'es2020'` | `target: profile.esTarget` |
| `view-compiler.js:330` | `target: ['es2020'], minify: true` | `target: [profile.esTarget], minify: profile.minify` |
| `logic-compiler.js:95` | `if (enableSourcemap) { /* 跳过 minify */ }` | minify 判定改为 `profile.minify && !enableSourcemap`（保留 sourcemap 兼容） |

**首版缺省行为不变**：build（native）profile = es2023 + minify → 与现状逐字节一致。

## 4. CLI 语义

```bash
dmcc build                                # platform=native, minify=true（缺省）
dmcc build --platform native              # 显式（等价缺省）
dmcc build --platform web                 # platform=web, esTarget=es2023, minify=true
dmcc build --no-minify                    # minify=false
dmcc dev                                  # platform=web, minify=false（mode 缺省）
dmcc dev --minify                         # platform=web, minify=true（用户覆盖）
```

## 5. D6:B 产物分层

| 层 | 跨 platform × mode | 内容 |
| --- | --- | --- |
| **不变层** | 结构一致 | modDefine 注册调用结构、模块 ID、目录结构、app-config.json、兼容性警告 |
| **可变层** | 由 profile 决定 | ES target、minify、sourcemap 策略 |

**modDefine 结构一致 ≠ 字节布局一致**：不 minify 时多行拼接（`modDefine('path', function(...){...});\n`）与 minified 单行都是合法 modDefine 格式，runtime 解析兼容。

## 6. renderer × platform 约束

```js
if (renderer === 'lynx' && platform === 'web') {
  throw new InvalidPlatformError('lynx renderer does not support web platform')
}
```

首版预留（无第二 renderer 时不触发）。

## 7. 失败语义

- 未知 platform：lifecycle 前、任何副作用前失败（对齐 renderer 模式）
- `InvalidPlatformError`：code `DIMINA_INVALID_PLATFORM`、platform 字段、context
- 无效 renderer×platform：同前置校验时机

## 8. 验证设计

1. platform/profile resolver spec：缺省/显式/未知/覆盖优先级
2. CLI integration：`--platform`、`--minify`/`--no-minify`（build + dev）
3. 缺省产物矩阵：改前 vs 改后（无参数），nomap/sourcemap，全示例 diff=0
4. dev 产物验证：不 minify（多行可读）；`--minify` 后与 build 等价
5. 不变层验证：不同 profile 产物中 modDefine 结构/目录/ID 一致
6. 相邻回归：compiler/render/sdk 全量、CLI/watch/dev/compile 入口
7. 消融：移除 platform 前置校验后目标 spec 失败

## 9. Acceptance mapping

| Requirement | Design point |
| --- | --- |
| R-001/R-002 | §2/§4 |
| R-003/R-004 | §3 |
| R-005 | §5 |
| R-006 | §8（缺省矩阵） |
| R-007 | §4/§8（dev minify 验证） |
| R-008 | §6 |
| R-009 | §8 |
| R-010 | §2 |
