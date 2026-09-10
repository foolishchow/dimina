# FE Tools Sidecar（Umbrella）

- Action: `fe-tools-sidecar`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[compiler-improvement](../_archive/complete/compiler-improvement/README.md)（已归档 A 轨道）、[compiler-configuration](../_archive/complete/compiler-configuration/README.md)（已归档 CF 门）、分支 `feature/compiler-improve` 上的私有演进
- 设计权威：本 umbrella 文档集（当前）；成熟后回写 `docs/` 专题或 RFC 附录。不替代上游产品权威。

## Background

`feature/compiler-improve` 已交付并归档多门编译器/dev/HMR/配置改造，但实现主要落在 `fe/packages/*`（尤其 `compiler` / `render` / `container-sdk`）。同时：

1. **不向 didi/dimina 推送**这些尚不成熟的能力；
2. 上游仍持续演进（如 v1.7.0 retention / map），长分支改主树会**反复制造 merge 冲突**；
3. 实际在做的已不止「compiler improve」，而是把 toolchain 往 **领域 bundler / dev 编排 + renderer 管线可插拔** 推进。

需要一条新 umbrella：在 **`fe/tools/*` 旁路孵化**，主路径 `packages/*` 与 upstream 同构；私有能力只在 tools（整包复制启动 → 再内部改造）。

## Goal

1. 建立 `fe/tools` 旁路战略与 TS-0 冻结约定（终态 B、命名、依赖方向）；与独立搬迁 Action 对齐但不父子绑定；
2. **搬迁冒烟本身**由 [`fe-tools-bootstrap-copy`](../fe-tools-bootstrap-copy/README.md) 独立交付（本伞 TS-1 仅记意图/前置）；
3. 在 tools 内再改造：**dev 编排**、**模板管线**（parser → IR → wxml→vue）、按需深改私有 sdk；
4. **终态 B**：`packages/*` 无私有 improve 长期 diff；预览/改造以 tools 为唯一私有面；
5. 不向 didi 推送本伞交付物。

## Non-goals

- 向 didi/dimina 合入本 umbrella 交付物。
- 一次拆出大量微包；首版复制启动后以 **少包 + 包内目录分层** 再拆。
- 通用 JS bundler 竞品；Lynx/skyline 生产落地；改原生三端工程。
- 在 `packages/*` 内保留「半套私有 compiler」与 tools 双份分叉（启动复制后，packages 侧回退干净）。

## Scope

| 区域 | 态度 |
| --- | --- |
| `fe/tools/*` | **主战场** |
| `fe/pnpm-workspace.yaml` | 增加 `tools/*` |
| `fe/packages/*` | **与 upstream 同构**（终态 B）；不作私有改造主战场 |
| `feature/compiler-improve` | **复制源快照**（tag 后只读取向） |
| `docs/actions/` | 本 umbrella；搬迁由独立 Action `fe-tools-bootstrap-copy` 交付（非子门） |

## TS-0 冻结决策（2026-09-10）

下列项视为 **TS-0 已拍板**（实施仍待 umbrella/`ready` 与授权；此处冻结「怎么做」而非授权开工）。

### D-TS0-1 终态 B

`fe/packages/*` 与 didi main 同构（无私有 improve 长期 diff）。私有能力只存在于 `fe/tools/*`。操作上以已对齐的 **`origin/main`** 为对照 tip（remote 名 `upstream` = didi）。

**可检查句（草案，可在 ready 前微调）**：工作分支上，`git diff origin/main...HEAD -- fe/packages` 为空，或仅含成文白名单且带撤出日期（测前 `origin/main` ≡ `upstream/main`）。

### D-TS0-2 分支策略

| 角色 | 分支 / 标记 | 规则 |
| --- | --- | --- |
| 复制源 | `feature/compiler-improve` | 不可变 tag **`fe-tools-copy-source`**（以 bootstrap Action D-BC-2 为准）；之后 improve 默认不再堆 sidecar 大改 |
| 工作分支（搬迁） | 由独立 Action 冻结为 **`feature/fe-tools-bootstrap`**（自已对齐 didi 的 **`origin/main`**） | `packages/*` 保持干净；tools + bootstrap 文档；伞文档 MAY 同分支演进 |
| 工作分支（伞长期，可选） | 可继续沿用 `feature/fe-tools-bootstrap`，或日后另开；**不再建议**抢先占用未交付的 `feature/fe-tools-sidecar` 名 | 与 bootstrap 闭合后再定 |
| 上游同步 | 工作分支定期 `merge origin/main`（`origin/main` 先追 didi） | 冲突应落在极少 `packages` 文件；tools 内副本单独追源（见 D-TS0-4） |

**不采用**：在 `feature/compiler-improve` 上直接做整包复制再大规模还原 `packages`（等效终态但 git 更脏）。

### D-TS0-3 复制源

- **树内容**：tag 指向的 improve 快照中的  
  - `fe/packages/compiler/**`  
  - `fe/packages/container-sdk/**`  
  （含该快照上已有的 dmcc/HMR/entryPath/`NODE_ENV`/菜单等私有改动）
- **元数据**：每个 tools 包内保留 `VENDOR.md`（或等价）：源 tag、源路径、复制日期、同步责任说明。

### D-TS0-4 目标包名与目录（npm / workspace / 磁盘）

| 源（packages） | 目录（冻结） | 包名（冻结） |
| --- | --- | --- |
| `@dimina/compiler` | **`fe/tools/bundler`** | **`@dimina/bundler`** |
| `@dimina/fe-container-sdk` | **`fe/tools/web-container-sdk`** | **`@dimina/web-container-sdk`** |

| 项 | 冻结值 |
| --- | --- |
| 私有 CLI bin | **`dimina-cli`**（挂在 `@dimina/bundler`，入口对齐原 `dmcc` 能力面；**不得**占用裸 `dmcc` / 裸 `dimina`） |

规则：

- 禁止与上游/packages 包名并存混用同一 name（不得叫 `@dimina/compiler` / `@dimina/fe-container-sdk`）。
- **命名释义（必读）**：`bundler` 在此指 **领域编译 + 预览 toolchain**（improve 快照整包复制的 compiler 后继），**不是**通用 JS bundler（webpack/vite 竞品）。`package.json` `description` 须写明该释义。
- 依赖：`@dimina/web-container-sdk` → `@dimina/bundler`（及 mitt 等）按需；**禁止** `packages/*` → `@dimina/bundler` / `@dimina/web-container-sdk`。
- 干净 `@dimina/compiler` / `@dimina/fe-container-sdk` 仍供产品/上游同构面使用；**本旁路预览链默认走私有 `@dimina/bundler` + `@dimina/web-container-sdk`**。
- 编排（原 `dmcc dev`）第一期可留在 `@dimina/bundler` 的 `dimina-cli` 子命令内；若日后抽出薄包，再建 `tools/dev-server`（非本冻结项）。

### D-TS0-5 启动策略（相对「薄 depend 再拷」）

**采用**：工作分支上 **整包复制** compiler + container-sdk → 落入上表目录/包名 → **`dimina-cli` 冒烟 work** → 再在 tools 内改造（拆编排、拆 template 管线、深改 web-container-sdk）。

不采用「长期 thin 包只 depend 脏 packages」作为终态路径（可作可选探针，非主路径）。

### D-TS0-6 目录布局

**已冻为扁平双包**（原讨论候选的收束版）：

```text
fe/tools/
  bundler/                 → @dimina/bundler      bin: dimina-cli
  web-container-sdk/       → @dimina/web-container-sdk
```

`pnpm-workspace.yaml`：`packages/*` + `tools/*`。不采用 bundler 目录下再嵌套第二 workspace 包作为首刀。

## ~~目录布局候选~~（已收束为 D-TS0-4 / D-TS0-6）

历史候选 A–D 见 git 历史；现行以冻结表为准。

## 核心设计原则

1. 旁路优先 + **终态 B**（D-TS0-1）。  
2. 分支与复制源按 D-TS0-2 / D-TS0-3。  
3. 目录/包名/bin 按 D-TS0-4 / D-TS0-6；整包复制启动按 D-TS0-5。  
4. 单向依赖：tools → packages（干净面）允许；packages → tools 禁止；tools 内 `@dimina/bundler` ↔ `@dimina/web-container-sdk` 互依允许。  
5. 两轴分离（编排 / 模板管线）在 **复制 work 之后** 于 tools 内推进。  
6. 复制带来源元数据；upstream 升版优先 merge 进工作分支的 packages，再按需同步进 tools 副本。

## Deliverables（伞级）

- workspace 含 `tools/*`；`@dimina/bundler` 与 `@dimina/web-container-sdk` 可 filter；
- `dimina-cli` 冷启动冒烟（base 示例或成文替身）；
- `packages/*` 满足终态 B 可检查句；
- 后续子门：编排拆分、template IR、文档/CI；
- VENDOR 元数据与同步说明；`@dimina/bundler` description 含领域 bundler 释义。

## Umbrella 机制

- **TS-1 不立子门**：复制冒烟由独立 Action `fe-tools-bootstrap-copy` 完成并可单独闭合/归档。  
- TS-2+ 再 formalize 子 Action（或继续独立 Action）；发现回流本 README / roadmap。  
- 闭合：TS-0 冻结有效；TS-1 前置 Action complete；TS-2..TS-4 complete 或书面 deferred。

## Roadmap（摘要）

详见 [roadmap](roadmap.md)。

| 门 | 意图 |
| --- | --- |
| TS-0 | 冻结项 D-TS0-1..6（已写入）+ workspace glob 实施 |
| TS-1 | 意图：复制改名接线冒烟 → **前置**独立 Action `fe-tools-bootstrap-copy`（非子门） |
| TS-2 | tools 内模板管线切开（parse / IR / webview） |
| TS-3 | 编排可选拆包与 sdk 深改边界 |
| TS-4 | 终态 B 门禁闭环与同步节奏 |

## Readiness gaps

1. ~~复制源 / 目标包名 / 分支 / 目录 / bin~~ — **已冻**（D-TS0-2..6）。  
2. **最小 IR 形状**未起草（阻塞 TS-2 `ready`）。  
3. **终态 B 可检查句**需在 `ready` 前写成 STATUS/验收可引用的最终句（D-TS0-1 草案已有）。  
4. **CI**：tools 独立 job 与否。  
5. **tag 名**实施时敲定并写入 VENDOR.md。

伞级在 B 判定句（gap 3）补齐前可维持 `draft`；**不授权伞级实施**。独立搬迁 Action 可单独授权，不阻塞于本伞 `ready`。

## Closure conditions

- TS 门完成或 deferred；  
- 终态 B 可检查；  
- packages 不依赖 tools；  
- VENDOR/同步说明存在；  
- STATUS/导航一致。
