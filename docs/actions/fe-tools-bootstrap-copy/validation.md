# Validation — fe-tools-bootstrap-copy

计划命令与证据形态；实际结果在执行阶段填写。

## 计划命令

| ID | 用途 | 命令 / 方法（草案） | 证据形态 |
| --- | --- | --- | --- |
| P-001 | 工作分支起点 | `git rev-parse origin/main upstream/main` 同 tip；`git merge-base HEAD origin/main`；记录 fork sha | sha + 说明 |
| P-002 | copy-source tag | `git rev-parse fe-tools-copy-source`；与两包 `VENDOR.md` 一致 | tag sha |
| P-003 | workspace / filter | `cd fe && pnpm install`；`pnpm --filter @dimina/web-container-sdk build`；`pnpm --filter @dimina/bundler build` | 退出码 + 日志 |
| P-004 | packages 干净 | `git diff origin/main...HEAD -- fe/packages` | 空输出或白名单附件 |
| P-005 | 单向依赖 | `rg '@dimina/(bundler\|web-container-sdk)' fe/packages --glob package.json` | 无匹配 |
| P-006 | 冷启动冒烟 | 见下方已冻冒烟命令 | 监听 + HTTP 200 + 日志 |

### 冒烟（D-BC-7/8，已冻）

在 `fe/` 工作区、依赖已 install、两包已 build 的前提下：

```bash
# 仓库根为 $REPO
cd "$REPO/fe"
pnpm --filter @dimina/bundler exec dimina-cli dev \
  -c "$REPO/examples/miniprogram/base" \
  --no-app-id-dir \
  --host 127.0.0.1
# 另开终端：curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:<port>/
# 成功：宿主页 200；dev 进程保持运行。LAN 场景可将 --host 改为 0.0.0.0（非本门 MUST）。
```

端口以 CLI 日志打印为准。若 `exec dimina-cli` 因 bin 链接失败，等价：`node tools/bundler/dist/bin/index.js dev …`（须在 validation 实记所用形式）。

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 实际执行记录

（实施后填写）
