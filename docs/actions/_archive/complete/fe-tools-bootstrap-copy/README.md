# FE Tools Bootstrap Copy

- Action: `fe-tools-bootstrap-copy`
- Status: `complete`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review #2 pass；G2 采纳 validation 冒烟草案为冻结）
- Authorized: 2026-09-10（对齐 origin/main → tag → 开分支实施）
- Archived: 2026-09-10
- Status authority: [Action Status](../../../STATUS.md)
- 关系：独立 Action（**不是**任何 umbrella 的子门）。策略背景可对照 [`fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)；本门闭合不依赖该伞 `ready`。
- 设计权威：本目录文档；命名/终态约定见下方 **D-BC-***（与 sidecar 伞 TS-0 对齐，但以本 Action 为准）。
- Draft review：#1 + #2（2026-09-10）→ `ready` → 实施 → **`complete`**。

## Background

`feature/compiler-improve` 上的私有能力主要落在 `fe/packages/{compiler,container-sdk}`，与 didi main 长期分叉会反复制造 merge 冲突。需要一次**有界搬迁**：从已对齐 didi 的 **`origin/main`** 开工，把 improve 快照整包放进 `fe/tools`，改名接线至可冒烟，且 **`fe/packages` 与 `origin/main` 同构**。

后续模板管线 / 深改等战略工作可另立 Action 或由 sidecar 伞承接；**不在本门治理范围**。

## Goal

1. 建立工作分支 `feature/fe-tools-bootstrap`（自已对齐 didi 的 **`origin/main`**）与 copy-source 不可变 tag `fe-tools-copy-source`（自 `feature/compiler-improve`）；
2. 将 improve 快照中的 **compiler → `fe/tools/bundler`（`@dimina/bundler`）**、**container-sdk → `fe/tools/web-container-sdk`（`@dimina/web-container-sdk`）** 整包复制并改名；
3. 带入本 Action 与 improve 相关的 **docs**（见 Scope），使 STATUS 可追溯；
4. 配置 `fe/pnpm-workspace.yaml` 的 `tools/*`，`dimina-cli` 冷启动冒烟通过；
5. 验证：`fe/packages` 相对 **`origin/main`**（已与 didi 对齐）无私有 improve diff。

## Non-goals

- 拆 parser / IR / wxml→vue；抽出独立 `@dimina/dev-server`；向 didi 推送 / 开 PR。
- 默认整仓复制 `fe/packages/render` 等其它包（仅当冒烟**证明**缺其 improve 面无法 build/启动时，扩大 Scope 并更新验收——不得静默扩大）。
- 复制接线以外的功能改造（改名/路径/bin/workspace 除外）。
- 作为 sidecar 伞的子门验收或等待伞级授权。
- 本门内保证 `packages/compiler` 测试套全绿（冒烟优先；tools 内既有测试「能跑则跑」为 SHOULD，失败不自动扩大 Scope）。

## 冻结决策（D-BC，本 Action 权威）

| ID | 内容 |
| --- | --- |
| D-BC-1 | **终态（本门）**：工作分支上 `git diff origin/main...HEAD -- fe/packages` 为空（或成文白名单+撤出日期）。**前置**：`origin/main` 已与 didi（`upstream/main`）对齐 |
| D-BC-2 | **复制源 tag**：**`fe-tools-copy-source`**（指向 improve tip，不可变）；之后 improve 默认不再堆本门大改 |
| D-BC-3 | **工作分支**：**`feature/fe-tools-bootstrap`**，自 **`origin/main`** 创建（`git checkout -b feature/fe-tools-bootstrap origin/main`）。开分支前：`git fetch origin`（及 `upstream`），确认 `origin/main` 与 `upstream/main` 同 tip；若落后则先把 didi main 合入/快进到 `origin/main` 再拉分支 |
| D-BC-4 | **目录/包名/bin**：`tools/bundler`→`@dimina/bundler`+`dimina-cli`；`tools/web-container-sdk`→`@dimina/web-container-sdk`；bundler description 含「领域 toolchain，非通用 JS bundler」 |
| D-BC-5 | **依赖方向**：`tools → packages` 允许；**禁止** `packages → tools` |
| D-BC-6 | **布局**：扁平 `fe/tools/*` + workspace `tools/*` |
| D-BC-7 | **冒烟示例**：`examples/miniprogram/base`（相对仓库根） |
| D-BC-8 | **冒烟命令（已冻）**：见 [validation](validation.md) 草案；成功判据：进程保持监听 + 宿主页 HTTP 200。`pnpm --filter @dimina/bundler exec dimina-cli` 失败时允许等价 `node tools/bundler/dist/bin/index.js`，实施时实记所用形式 |

## Scope

### 分支与 tag

| 步骤 | 动作 |
| --- | --- |
| 0 | **本 Action 文档须先进入 improve tip / 进 tag**（否则从 `origin/main` 拉出的工作分支拿不到文档）。推荐：在 improve 上 commit 文档 → tag `fe-tools-copy-source` → 再开工作分支 |
| 1 | tag `fe-tools-copy-source` |
| 2 | 对齐 `origin/main` ← didi；`git checkout -b feature/fe-tools-bootstrap origin/main` |
| 3 | 自 tag checkout 本 Action 文档（及 Scope 内其它 docs） |

### 代码复制

| 源（tag 内路径） | 目标 |
| --- | --- |
| `fe/packages/compiler/**` | `fe/tools/bundler/**` |
| `fe/packages/container-sdk/**` | `fe/tools/web-container-sdk/**` |

复制后必须改写（至少）：

| 类 | 示例 |
| --- | --- |
| package name / bin | `@dimina/compiler`→`@dimina/bundler`；`dmcc`→`dimina-cli`；`@dimina/fe-container-sdk`→`@dimina/web-container-sdk` |
| description | bundler 含领域 toolchain 释义 |
| 兄弟路径 | `copy-sdk-assets.js` 等 `../container-sdk` → `../web-container-sdk` |
| filter / 文案 | `pnpm --filter fe-container-sdk` / `@dimina/compiler` 字符串 |
| 自引用路径 | 测试/bin 中 `packages/compiler` 等（按需改为 `tools/bundler` 或相对包根） |
| VENDOR.md | 源 tag、源路径、日期 |
| 单向依赖 | packages 不得依赖新包名 |

### Docs 复制

| 纳入 | 说明 |
| --- | --- |
| `docs/actions/fe-tools-bootstrap-copy/**` | 本 Action（MUST） |
| `docs/actions/STATUS.md` / `TODO.md` / `README.md` 中与本 Action 相关的行 | MUST；**禁止**用 improve 整文件盲覆盖干净 main 上已有 STATUS（合并本 Action 行，保留 main 既有行） |
| **MAY**：`docs/actions/fe-tools-sidecar/**` | 非本门闭合条件 |
| **SHOULD**：`docs/actions/_archive/complete/**`（improve 归档）+ `docs/Compiler-Architecture-RFC.md` improve 增量 | 历史可追溯 |

**不默认**整份 `docs/` 无差别覆盖。

### Workspace

- `fe/pnpm-workspace.yaml`：`packages/*` + `tools/*`

## Deliverables

- 分支 `feature/fe-tools-bootstrap` + tag `fe-tools-copy-source`；
- `fe/tools/bundler`、`fe/tools/web-container-sdk` 可 build（含 sdk 资产复制进 bundler `dist/sdk` 的既有 postbuild 路径，路径已改写）；
- `dimina-cli` 冷启动冒烟（D-BC-7/8）；
- 各包 `VENDOR.md`；
- [acceptance](acceptance.md) / [validation](validation.md) 证据；
- packages diff 门禁满足。

## Approach

```text
0. commit bootstrap Action docs on improve (if not already)
1. tag fe-tools-copy-source on improve tip
2. git fetch origin && git fetch upstream
   # ensure origin/main == upstream/main (fast-forward / merge into origin/main if behind)
3. git checkout -b feature/fe-tools-bootstrap origin/main
4. git checkout fe-tools-copy-source -- <scoped docs>
5. copy compiler → bundler, container-sdk → web-container-sdk
6. rename package.json / bin / sibling paths / filter strings; add VENDOR.md
7. pnpm-workspace tools/*; install; build web-container-sdk then bundler
8. smoke per validation.md
9. assert fe/packages diff vs origin/main is empty
```

## Readiness gaps（review #2 → ready · 2026-09-10）

| # | Gap | 阻塞 ready？ | 状态 |
| --- | --- | --- | --- |
| G1 | 工作分支 / tag / origin 对齐 | 否 | **已冻** D-BC-1..3 |
| G2 | 冒烟 argv | 否 | **已冻** D-BC-8 + validation；实施实记最终形式 |
| G3 | 干净 main 上 render/components 兼容 | 否（实施期） | 保留；失败则 blocked/扩 Scope |
| G4 | 改名清单 | 否 | Scope 表已有 |
| G5 | 实施授权 | 实施门 | **已授权并完成** |
| G6 | validation 计划表 | 否 | 已有 |
| G7 | STATUS 合并策略 | 否 | 禁止盲覆盖（main 无既有 actions，整树引入） |
| G8 | 开分支前对齐 `origin/main` ← didi | 实施前置 | **已完成**（`c579adaa`） |
| G3 | render/components 兼容 | 实施期 | **冒烟通过，无需扩 Scope** |

**Verdict**：A-B01..A-B08 `passed`；归档 `complete`。

## Closure conditions

- acceptance 项通过并有证据 — **满足**  
- D-BC-1 门禁满足 — **满足**  
- STATUS 本行更新为 `complete` 并归档 — **本闭合完成**

## Closure decision（2026-09-10）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/fe-tools-bootstrap-copy/`。
- **交付**：`fe/tools/bundler`（`@dimina/bundler` / `dimina-cli`）、`fe/tools/web-container-sdk`（`@dimina/web-container-sdk`）；workspace `tools/*`；tag `fe-tools-copy-source`；分支 `feature/fe-tools-bootstrap`。
- **冒烟**：`node fe/tools/bundler/dist/bin/index.js dev …` → `127.0.0.1:8080` HTTP 200（`pnpm exec dimina-cli` 失败，按 D-BC-8 回退）。
- **packages**：相对 `origin/main` 无 diff；无反向依赖。
- **持久发现**：旁路 toolchain 已可在干净 main 上冷启动；后续管线改造归 sidecar 伞 / 新 Action。

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | MUST |
| [acceptance](acceptance.md) | 验收表 |
| [validation](validation.md) | 计划命令与证据 |
| （可选对照）[fe-tools-sidecar](../../../fe-tools-sidecar/README.md) | 后续战略伞；非父门 |
