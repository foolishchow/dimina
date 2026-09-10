# Validation — fe-tools-bootstrap-copy

计划命令与证据形态；实际结果在执行阶段填写。

## 计划命令

| ID | 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- | --- |
| P-001 | 工作分支起点 | `git rev-parse origin/main upstream/main` 同 tip；`git merge-base HEAD origin/main`；记录 fork sha | sha + 说明 |
| P-002 | copy-source tag | `git rev-parse 'fe-tools-copy-source^{}'`；与两包 `VENDOR.md` 一致 | tag sha |
| P-003 | workspace / filter | `cd fe && pnpm install`；`pnpm --filter @dimina/web-container-sdk build`；`pnpm --filter @dimina/bundler build` | 退出码 + 日志 |
| P-004 | packages 干净 | `git diff origin/main...HEAD -- fe/packages`（及工作区 `fe/packages` 无改动） | 空输出 |
| P-005 | 单向依赖 | `rg '@dimina/(bundler\|web-container-sdk)' fe/packages --glob package.json` | 无匹配 |
| P-006 | 冷启动冒烟 | 见下方；**实记**使用 `node` bin 回退 | 监听 + HTTP 200 + 日志 |

### 冒烟（D-BC-7/8，已冻）

首选：

```bash
cd "$REPO/fe"
pnpm --filter @dimina/bundler exec dimina-cli dev \
  -c "$REPO/examples/miniprogram/base" \
  --no-app-id-dir \
  --host 127.0.0.1
```

本门实记：`pnpm … exec dimina-cli` 失败（`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`），改用等价：

```bash
node fe/tools/bundler/dist/bin/index.js dev \
  -c "$REPO/examples/miniprogram/base" \
  --no-app-id-dir \
  --host 127.0.0.1
```

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 实际执行记录

### 环境（2026-09-10）

| Field | Value |
| --- | --- |
| 日期 | 2026-09-10 |
| 工作分支 | `feature/fe-tools-bootstrap` |
| fork / `origin/main` / `upstream/main` | 均为 `c579adaa`（对齐后创建） |
| copy-source tag | `fe-tools-copy-source` → `242b8622` |
| Node | v22.22.0（engines 写 ≥22.22.3；本机构建/冒烟仍通过） |
| pnpm | 12.2.0（via `node …/pnpm.mjs`；corepack shim 缺 `pnpm.cjs`） |

### P-001 — passed

`origin/main` ≡ `upstream/main` ≡ `c579adaa`；`merge-base(HEAD, origin/main)=c579adaa`。

### P-002 — passed

Tag `fe-tools-copy-source` → `242b8622`；`fe/tools/bundler/VENDOR.md` 与 `fe/tools/web-container-sdk/VENDOR.md` 均引用该 tag / sha。

### P-003 — passed

- `pnpm install`：Scope 12 workspace projects，Done。
- `pnpm --filter @dimina/web-container-sdk build`：vite + tsc 成功。
- `pnpm --filter @dimina/bundler build`：vite + copy-sdk-assets + check-package-exports（Validated 5 ESM exports and the dimina-cli CLI）成功。

### P-004 — passed

`git diff origin/main -- fe/packages` 空；工作区 `fe/packages` 无改动。

### P-005 — passed

`rg` 对 `fe/packages/**/package.json` 无 `@dimina/bundler` / `@dimina/web-container-sdk` 匹配。

### P-006 — passed

命令：`node fe/tools/bundler/dist/bin/index.js dev -c examples/miniprogram/base --no-app-id-dir --host 127.0.0.1`

- 日志：`[dmcc-dev] preview at http://127.0.0.1:8080?appId=wxbaf4b47de04f1d8a`
- `curl http://127.0.0.1:8080/` → **HTTP 200**
- `curl http://127.0.0.1:8080/?appId=…` → **HTTP 200**

偏差：首选 `pnpm --filter @dimina/bundler exec dimina-cli` 失败，已按 D-BC-8 使用 `node …/dist/bin/index.js` 等价路径。
