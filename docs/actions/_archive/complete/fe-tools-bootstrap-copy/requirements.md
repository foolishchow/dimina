# Requirements — fe-tools-bootstrap-copy

## R-B1（MUST）干净起点

工作分支名为 **`feature/fe-tools-bootstrap`**，从 **`origin/main`** 创建；开分支前 `origin/main` 须与 didi（`upstream/main`）对齐。不在 `feature/compiler-improve` 上直接落地 tools 复制。

## R-B2（MUST）不可变复制源

存在 git tag **`fe-tools-copy-source`**（指向 improve 完整能力 tip）；两包 `VENDOR.md` 引用该 tag。

## R-B3（MUST）双包落地

- `fe/tools/bundler` → `@dimina/bundler`，bin `dimina-cli`
- `fe/tools/web-container-sdk` → `@dimina/web-container-sdk`

内容来自 tag 内对应 packages 树；改名与依赖改写完整；bundler description 含「领域 toolchain，非通用 JS bundler」。

## R-B4（MUST）Docs 最小集

工作分支含本 Action 文档，且 `docs/actions/STATUS.md` 登记本 Action（合并行，不盲覆盖 main 既有 STATUS）。sidecar 伞文档非必须。

## R-B5（MUST）Workspace

`fe/pnpm-workspace.yaml` 含 `tools/*`；可 `pnpm --filter @dimina/bundler` / `@dimina/web-container-sdk`。

## R-B6（MUST）packages 干净（D-BC-1）

`git diff origin/main...HEAD -- fe/packages` 为空（或仅成文白名单）。测前确认 `origin/main` 已与 `upstream/main` 同 tip。

## R-B7（MUST）冷启动冒烟

对 **`examples/miniprogram/base`**，按 [validation](validation.md) 冻结/实记的 `dimina-cli dev`（或写死等价 `node …/bin`）完成编译+预览冷启动；成功判据：进程保持监听且宿主页 HTTP 200。失败不得用「未复制 render」静默忽略。

## R-B8（MUST）单向依赖（D-BC-5）

`fe/packages/*` 不依赖 `@dimina/bundler` / `@dimina/web-container-sdk`。

## Non-requirements

- sidecar 伞 `ready` / 子门治理；TS-2+ 管线拆分；功能行为改造；推 upstream。
