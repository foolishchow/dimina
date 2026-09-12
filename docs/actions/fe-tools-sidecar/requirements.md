# Requirements — fe-tools-sidecar

## R-001（MUST）旁路主战场

私有 toolchain 能力的长期实现位置为 `fe/tools/*`，不得以「继续在 `fe/packages/*` 上堆私有 diff」作为本 umbrella 的默认交付形态。

## R-002（MUST）Workspace 成员

`fe/pnpm-workspace.yaml` 包含 `tools/*`；工具包可通过 `pnpm --filter` 安装与测试。

## R-003（MUST）单向依赖

允许 `tools → packages`；禁止 `packages → tools`。验收须可静态或 CI 检查。

## R-004（MUST）依赖优先于复制

对 `@dimina/compiler`（及其它 packages）优先使用公开/已交付 API（如 `build`、`createBuildWatcher`）。仅当 API 无法表达时才复制；复制必须标注来源并记录同步责任。

## R-005（MUST）编排落在私有 bundler / 后续拆包

dev 编排（宿主页、静态服务、WS、代理、reload、预览资产）由 `@dimina/bundler` 的 `dimina-cli` 承载（D-TS0-4），或在 TS-3 再抽薄包。不得以改脏 `packages/compiler` 作为私有编排主战场。

## R-006（MUST）管线轴可切开

在 `@dimina/bundler` 内，模板路径具备 **parse → 中立 IR → renderer 后端** 的逻辑边界（TS-2）；首版允许同包多入口，IR 边界须可单测。

**时机（2026-09-12）**：对应伞门 **TS-2 书面 deferred**——本条仍为伞闭合 MUST，**近端不实施**；再激活条件见 [README](./README.md)「TS-2 deferred」。近端结构工作优先讨论 `runBuild` 阶段化（另 Action），勿与本条混为同一刀。

## R-007（MUST）renderer 与 platform 正交

parser / IR **不得**绑定 `platform: native|web`；renderer 选择后端（今日仅 webview→vue）。

## R-008（MUST）Bootstrap 复制 web-container-sdk

启动路径将 improve 快照中的 container-sdk **整包复制**为 `@dimina/web-container-sdk`（目录 `fe/tools/web-container-sdk`）。后续深改只在该私有包内进行；不得改脏 `packages/container-sdk` 作为私有主战场。

## R-009（MUST）终态 B：packages 与 upstream 同构

工作分支上 `fe/packages/*` 与已对齐的 `origin/main`（didi）同构（无私有 improve 长期 diff）。预览/改造以 `fe/tools` 内 `@dimina/bundler` + `@dimina/web-container-sdk` 为唯一私有面。可检查句与同步节奏见 [sync-rhythm.md](./sync-rhythm.md)（TS-4；D-TS0-1 最终句）。

## R-011（MUST）分支与复制源

实施复制前：对 `feature/compiler-improve` 打不可变 tag；工作在从已对齐的 `origin/main` 拉出的 `feature/fe-tools-bootstrap` 上进行（D-TS0-2/3；细节以 bootstrap Action D-BC 为准）。

**落地备注（2026-09-10）**：tag `fe-tools-copy-source`、搬迁期分支名 `feature/fe-tools-bootstrap`（后改名为 **`feature/fe-tools-sidecar`**）、双包与冒烟已由 [`fe-tools-bootstrap-copy`](../_archive/complete/fe-tools-bootstrap-copy/README.md) 完成；本条保留为历史前置说明，不再阻塞 TS-2。

## R-012（MUST）目标目录、包名与 bin

| 目录 | 包名 | bin |
| --- | --- | --- |
| `fe/tools/bundler` | `@dimina/bundler` | `dimina-cli` |
| `fe/tools/web-container-sdk` | `@dimina/web-container-sdk` | — |

不得占用 `@dimina/compiler` / `@dimina/fe-container-sdk` / 裸 `dmcc` / 裸 `dimina`（D-TS0-4/6）。

## R-010（MUST）不推 upstream

本伞交付物不包含向 `didi/dimina` 开 PR / 推送的要求；文档与验收不得依赖「已合入上游」。

## Non-requirements

- 多 renderer 生产实现；通用 bundler；原生三端改造；一次拆出 ≥3 个 template 微包。
