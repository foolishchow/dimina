# Validation — fe-tools-wxml-ir

Status: **ready 计划面** — Experience §5/§6 已入档；无实施证据

权威参考：[Experience-Review.md](../../Experience-Review.md)

## Planned

| ID | 命令 / 观察 | 对应 Acceptance |
| --- | --- | --- |
| P-WIR00 | `cd fe/tools/bundler && node scripts/sync-dist-from-src.js`（src 改动后、对拍 / CLI 前） | 前置 |
| P-WIR01 | `cd fe/tools/bundler && pnpm exec vitest run --no-file-parallelism`（或 `fe/node_modules/.bin/vitest`） | A-WIR0..3、A-WIR7 |
| P-WIR02 | 见下方 **产物对拍程序**（nomap + sourcemap，`diff -rq` = 0） | A-WIR3、A-WIR6 |
| P-WIR03 | `rg "platform\\s*===" fe/tools/bundler/src/compiler/wxml`（目录落地后）；命中须空 | A-WIR4 |
| P-WIR04 | `git diff --stat`：无 E7 / Listr / PS3 / **S14**；实现为 JS；主改动在 `compiler/wxml/**` + `view-compiler.js` + 测例；**`fe/packages` 无本门私有 diff** | A-WIR5 |
| P-WIR05 | parse/load 测例：关键节点 `loc: { start, end }`；跨文件 `sourceFile` 可追溯 | A-WIR6 |
| P-WIR06 | 消融（见下方纪律）：① 去 registry / Document 缝；② 去 loc / 强制猜行 — **分别**消融 | A-WIR2、A-WIR6 |
| P-WIR07 | 审查：归属表与实现一致；cheerio 不变量；错误日志带 `[wxml]` + `sourceFile`/`loc`（有错误路径时） | A-WIR1、A-WIR8、A-WIR9 |

### 产物对拍程序（P-WIR02 · 对齐 compiler-target）

仓库根 `REPO`；示例工程恒用 **同一** `examples/miniprogram/base` 绝对路径。

```sh
# 0) sync dist
cd "$REPO/fe/tools/bundler" && node scripts/sync-dist-from-src.js

# 1) 实施前（或对照基线 tip）打快照
WORK=/tmp/dimina-wir-diff
rm -rf "$WORK" && mkdir -p "$WORK/base-nomap" "$WORK/base-sm"
node -e "
import build from '$REPO/fe/tools/bundler/dist/index.js';
await build('$WORK/base-nomap', '$REPO/examples/miniprogram/base', false);
await build('$WORK/base-sm', '$REPO/examples/miniprogram/base', false, { sourcemap: true });
"

# 2) 实施后 HEAD 再编
mkdir -p "$WORK/head-nomap" "$WORK/head-sm"
node -e "
import build from '$REPO/fe/tools/bundler/dist/index.js';
await build('$WORK/head-nomap', '$REPO/examples/miniprogram/base', false);
await build('$WORK/head-sm', '$REPO/examples/miniprogram/base', false, { sourcemap: true });
"

# 3) 必须均为 0
diff -rq "$WORK/base-nomap" "$WORK/head-nomap"
diff -rq "$WORK/base-sm" "$WORK/head-sm"
```

基线随门递进：每门开工前重打 `base-*`；**不允许**未写入本文件的差分白名单（D-WIR-9）。

## Ablation 纪律（Experience-Review §6）

- 先在含修复的代码上跑通目标断言，再**只**禁用/移除待验证的最小机制；**不得**同时改测试、夹具、输入或断言。
- 消融后失败必须来自**原缺陷对应断言**（非编译错误 / 环境损坏 / 无关超时）。
- 两项机制（Backend 缝、loc/sourcemap）**分别**消融；禁止只做整文件回退冒充分项证据。
- 优先在隔离工作树或临时副本消融；**禁止**用 `git reset --hard` / 整文件覆盖破坏用户工作区。
- 消融补丁与临时日志**不得**进入最终提交；交付说明记录：目标用例、消融内容、预期/实际失败点、恢复后复跑结果。
- 消融只证明「用例能识别机制缺失」，**不等于**预览/视觉/真机验收（见 Uncovered）。

## Uncovered（本 Action 不强制 · Experience §5）

闭合时须在 Actual 中声明下列为 **未验证 / 非本门**（不得用「vitest 全绿」冒充已覆盖）：

| 项 | 说明 |
| --- | --- |
| Web 预览冒烟（`dimina-cli dev`） | 非 MUST |
| 第二示例工程 / 多页专项 | 仅 `examples/miniprogram/base` 对拍 |
| 真机 / 原生容器 / 视觉截图 | 非本门 |
| 微信真源语义逐条对拍 | 见 README Residual；非本门 |
| 表达式 Accept/Reject 全量 | Non-requirements |

## 诊断日志（Experience §7）

- parse / load / registry 用户可见错误：统一前缀 **`[wxml]`**；
- 尽量带结构化字段：`sourceFile`、`loc.start`/`loc.end`（或派生 line/column）、阶段名（`parse`|`load`|`backend`）；
- 禁止残留仅用于本次定位的临时 `console.log`；高频路径不刷无关日志。

## Actual

（实施后填写：P-WIR 结果、消融记录、Uncovered 勾选）
