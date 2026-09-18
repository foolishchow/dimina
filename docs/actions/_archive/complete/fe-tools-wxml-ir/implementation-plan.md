# Implementation plan — fe-tools-wxml-ir

Status: **ready** — D-WIR + Review 已冻；**未授权实施**（须另授权 `in_progress`）

## 落点

```text
fe/tools/bundler/src/compiler/wxml/{parse,load,document,backends/*}
fe/tools/bundler/src/compiler/view-compiler.js   # 编排壳
fe/tools/bundler/__tests__/…                    # parse/load/backend 测例
```

## 门序

| 门 | 任务方向 | 验证点 |
| --- | --- | --- |
| **T-IR0** | `wxml/parse.js` + Document/`loc`（D-WIR-5/6/7） | P-WIR01 / P-WIR05 |
| **T-IR1** | `wxml/load.js`；归属表 load 行；LoadedGraph | P-WIR01 / P-WIR07 |
| **T-IR2** | `backends/vue.js`；view-compiler 编排；cheerio 不变量 | P-WIR00..02 |
| **T-IR3** | `backends/registry.js` + `stub.js` | P-WIR06 |

## 明确不做

- E7 / Listr / PS3 / S14 / 生产第二 renderer
- 真手写扫描、表达式 Accept/Reject 全量
- 第二种实现语言

## 依赖

- 与 [`fe-tools-incremental-target`](../fe-tools-incremental-target/README.md) 互不阻塞；同改 `view-compiler.js` 时分 PR、禁混范围（Experience §8：注意工作区未提交重叠）
- 实施前确认分支/`git status`；消融用隔离副本（Experience §6）
- 错误日志约定：`[wxml]` + sourceFile/loc（Experience §7；R-WIR9）

