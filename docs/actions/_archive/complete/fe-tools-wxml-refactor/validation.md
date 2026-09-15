# Validation — fe-tools-wxml-refactor

Status: **`complete`（归档）** — P-WR00..07 全 pass；Close 复验绑定 `13c9c902`。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WR00 | dist sync | `cd fe/tools/bundler && node scripts/sync-dist-from-src.js`（对拍 / CLI 前） | 前置 | **pass** |
| P-WR01 | W1 归位与模块链 | 对 technical-design §3 **23 名** `grep`：`view/index.js` 无其 `function` 定义；`transTagWxs` 允许仍在 index；`node --input-type=module` 依次 import index/transform/backend/worker；抽样函数体 diff | A-WR0 | pass（W1） |
| P-WR02 | Document contract | 标准 fixture：attrs=Attr[]、Value 三态、special type、directives/slot/selfClosing、null/[]（无缺键）；grep load/vue/vue-tools 无 cheerio、`_$`、`_elem`；§4.2 能力可指认；§4.5 无 normalize cheerio 环路；§4.6 `transTagWxs`/`transAsses` 无 `$` 入参且 load 不传投影句柄 | A-WR1/A-WR2 | pass（W2） |
| P-WR03 | W2 include/import/origin | include/import fixture：展开、sourceFile/span、序列化、template/wxs 排除与 Vue line origins | A-WR2 | pass（W2） |
| P-WR04 | parser switch + 语义对拍 | 默认 napi；`WXML_PARSER=cheerio`；非法值 `[wxml]`；同源 fixture 比较 type/name/value/directive/special/span（cheerio attr span null 例外） | A-WR3/A-WR5 | **pass** |
| P-WR05 | full regression | `cd fe/tools/bundler && node scripts/sync-dist-from-src.js && pnpm exec vitest run --no-file-parallelism`（或 `npx vitest`） | A-WR4 | **pass**（580/580） |
| P-WR06 | output behavior-0 | 见下方 **产物对拍程序**（默认 napi vs cheerio；nomap+sourcemap `diff -rq` = 0） | A-WR4 | **pass**（diff=0） |
| P-WR07 | ablation | 见下方纪律：① 破坏/拔掉 parser 开关使 cheerio 回退或默认选择失败；② 破坏标准 shape 分类使 transform 断言失败——**分别**消融；恢复后同命令通过 | A-WR5 | **pass** |

### 产物对拍程序（P-WR06）

仓库根 `REPO`；示例 `examples/miniprogram/base` 绝对路径两端一致。

```sh
cd "$REPO/fe/tools/bundler" && node scripts/sync-dist-from-src.js
WORK=/tmp/dimina-wr-diff
rm -rf "$WORK" && mkdir -p "$WORK/cheerio-nomap" "$WORK/cheerio-sm" "$WORK/napi-nomap" "$WORK/napi-sm"

# cheerio 基线
WXML_PARSER=cheerio node -e "
import build from '$REPO/fe/tools/bundler/dist/index.js';
await build('$WORK/cheerio-nomap', '$REPO/examples/miniprogram/base', false);
await build('$WORK/cheerio-sm', '$REPO/examples/miniprogram/base', false, { sourcemap: true });
"

# 默认 napi（不设或显式 napi）
WXML_PARSER=napi node -e "
import build from '$REPO/fe/tools/bundler/dist/index.js';
await build('$WORK/napi-nomap', '$REPO/examples/miniprogram/base', false);
await build('$WORK/napi-sm', '$REPO/examples/miniprogram/base', false, { sourcemap: true });
"

diff -rq "$WORK/cheerio-nomap" "$WORK/napi-nomap"
diff -rq "$WORK/cheerio-sm" "$WORK/napi-sm"
```

两模式 `diff -rq` 均须为 0（含 `.map`；**无**未写入本文件的差分白名单）。W1/W2 相对实施前 HEAD 的对拍：用同一程序，将「cheerio/napi」换成「base/head」快照即可。

## Ablation 纪律（Experience-Review §6）

- 先在含修复代码上跑通目标断言，再**只**禁用/移除待验证最小机制；**不得**同时改测试、夹具、输入或断言。
- 消融后失败必须来自**原缺陷对应断言**（非编译错误 / 环境损坏 / 无关超时）。
- 两项机制（parser 开关、标准 shape）**分别**消融；禁止只做整文件回退冒充分项证据。
- 优先隔离工作树或临时副本；**禁止** `git reset --hard` / 整文件覆盖破坏用户工作区。
- 消融补丁与临时日志**不得**进入最终提交；交付说明记录目标用例、消融内容、预期/实际失败点、恢复后复跑。
- 消融 ≠ 预览/真机/视觉验收（见 Uncovered）。

## Diff scope

`git diff --stat` 主改动：`fe/tools/bundler/src/compiler/view/wxml/`、必要的 `view/index.js` wiring（含就地薄适配 `transTagWxs`/`transAsses`）、tests、Action 文档、`dimina-wxml-parser` / napi 相关修复；**`fe/packages` 零改动**。

## Uncovered

预览 / 真机 / 视觉、跨平台 napi 预编译分发、性能、微信真源逐条对拍——非本 Action MUST（见 technical-design Residual）。

## Actual

（2026-09-15 · Close 复验绑定交付 commit **`13c9c902`**）

| ID | Result |
| --- | --- |
| P-WR00 | pass — `node scripts/sync-dist-from-src.js` 后对拍/全量 |
| P-WR01 | pass — §3 的 23 名在 `view/index.js` 无 `function` 定义；`transTagWxs` 仍在 index；模块链可 import；相对 `342af2f5` 产物+sourcemap diff=0 |
| P-WR02 | pass — Attr[]/特殊 type/无缺键；load/vue/vue-tools/transform 零 cheerio/`_$`/`_elem`；§4.6 Document 薄适配 |
| P-WR03 | pass — include/import/origin 测例与全量回归（随 P-WR05） |
| P-WR04 | pass — 默认 `napi`；`WXML_PARSER=cheerio` 可用；非法值抛 `[wxml] invalid WXML_PARSER=...; expected napi\|cheerio`；`__tests__/wxml-parser-switch.spec.js` 21/21 |
| P-WR05 | pass — Close 复验 `13c9c902`：`npx vitest run --no-file-parallelism` → **580/580**（79 files） |
| P-WR06 | pass — Close 复验 `13c9c902`：`examples/miniprogram/base` cheerio vs napi，nomap + sourcemap `diff -rq` 均为 **0**；W1/W2 相对基线 `342af2f5` 亦 diff=0 |
| P-WR07 | pass — 分项消融后均按目标断言失败，恢复后同命令通过（见下） |

### P-WR07 消融摘记

1. **parser 开关**：将 `resolveWxmlParserEngine` 缺省从 `napi` 改为 `broken-default` → `parseWxml` 抛 `[wxml] invalid WXML_PARSER=...`；`wxml-parser-switch` 中「缺省为 napi」等 2 例失败。恢复后 21/21 绿。
2. **标准 shape 分类**：将 `templateDef` 误映射为 `element` → `compareDocumentsSemantic` 报 `element !== template-def`；特殊节点 type 断言失败。恢复后 type=`template-def`，开关测例绿。

环境：darwin，bundler vitest 4.x；napi 经 `fe/tools/wxml-parser-napi` release 构建。`fe/packages` 零改动。
