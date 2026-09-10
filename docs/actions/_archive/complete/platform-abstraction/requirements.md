# Requirements — platform-abstraction

## R-001（MUST）platform 枚举接入 compile configuration

在 CF-1 `resolveCompileConfig` 上赋予 `platform` 完整语义：合法值仅为 `'native' | 'web'`；解析后 config **始终**带有确定的 `platform`（不再长期停留在 `undefined`）。非法值硬失败（在 `build:start` 之前）。

## R-002（MUST）CLI ⊆ API

- API：`options.platform`（及经 `createBuildWatcher({ options })` 透传）可设置 platform
- CLI：`dmcc build --platform <native|web>` 写入同一字段
- 不允许 CLI-only 能力；本门不把无关 API-only 选项新暴露为 CLI

## R-003（MUST）缺省与 `dmcc dev` 固定值

- 未指定时缺省 `platform: 'native'`（对齐「面向原生四端容器」的 build 语义）
- `dmcc dev` **固定** `platform: 'web'`（对齐 Web 容器预览）；本门 **不** 在 `dev` 上暴露 `--platform`
- `mode` 与 `platform` 正交：`mode=dev` 不自动推导 platform（由 bin/dev 显式注入）

## R-004（MUST）本门行为中立（产物 / 变换不变）

本门 **不得** 因 platform 改变：

- minify / mode preset
- `esTarget.logic` / `esTarget.view`
- sourcemap 是否生成、以及 map 文件内容生成逻辑

缺省 build（`platform=native` 或缺省）产物与改造前逐字节一致（diff=0）。

## R-005（MUST）`sourcemapStrategy` 语义标注

在 compile configuration 增加由 platform **派生**的只读字段：

| platform | sourcemapStrategy | 含义（文档/元数据） |
| --- | --- | --- |
| `native` | `quickjs-attach` | 面向 Harmony QuickJS 等 attach 调试 |
| `web` | `devtools-url` | 面向浏览器 DevTools |

本门仅写入/暴露该字段；**不**据此改写 sourcemap 管线（策略落地若需要，另立 Action）。

## R-006（MUST）renderer × platform 约束钩子

经 A4 `getRenderer` 读取当前 renderer；若 renderer 声明不支持当前 platform，构建前硬失败。当前仅 `webview`：native/web 均允许。为未来 `lynx` 等预留「不支持 web」的约束形状，本门不实现 lynx。

## R-007（MUST）RFC D6 → D6:B

闭合时回写 RFC：产物契约区分为**不变层**（结构/modDefine/目录/警告）与**可变层**（compile profile：`esTarget.{logic,view}`、minify、sourcemap 策略标注）。本门自身不扩大可变层行为面。

## R-008（MUST）`build()` 公开契约不变

签名、返回值、结构化错误契约不变；`options.platform` 为可选新增字段。

## R-009（MUST）规格全绿

`pnpm --filter compiler test`（或等价 `npx vitest run`）全绿；新增 platform / platforms / sourcemapStrategy / renderer×platform 规格。

## Non-scope

见 [README](README.md) Non-goals：改编译变换、抬 `esTarget.view`、CF-3 logic CJS 收敛、实现 lynx、改 A4 renderer 选择模型、改 sourcemap 生成实现。
