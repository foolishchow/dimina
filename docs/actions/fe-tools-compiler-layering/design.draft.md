# Design draft — fe-tools-compiler-layering

Status: **冻结 v1（2026-09-15）** — D-CL-1..3 + R1 F1-F6 + R2 F7 已收；实施中改设计须修订本档并同步 requirements / acceptance

## 目标结构（方案 A 两轴 + 61 函数穷举归属）

完整结构图与穷举归属表见 [README](README.md) §L0 目标结构（唯一权威，此处不复制——避免双源漂移）。

## 关键设计点

### 纯移动例外（F2）

```js
// stage-channel.js 修正前（同目录文件名约定）
new Worker(path.join(dirname, `./${script}-compiler.js`), …)

// 修正后（显式映射；spawn 目标不变）
const WORKER_ENTRY = {
  view: './view/index.js',
  logic: './logic/index.js',
  style: './style/index.js',
}
new Worker(path.join(dirname, WORKER_ENTRY[script]), …)
```

- `logic/index.js` 与 `style/index.js` 即原 `logic-compiler.js` / `style-compiler.js` 的重命名落点（纯 git mv + 文件名变更，内容零变更）
- `view/index.js` 承载原 view-compiler.js 的编排入口 + worker 协议（聚合落点；F6 注记：后续可拆 view/worker.js）

### import 更新范围

| 来源 | 消费方 | 更新量 |
| --- | --- | --- |
| view-compiler.js | wxml/{load,parse,backends/vue}（ctx.tools 注入）+ 12 spec | ~15 文件 |
| logic-compiler.js | build-pipeline / stage-channel（spawn 路径） | spawn 映射 1 处 |
| style-compiler.js | 同上 | 同上 |
| env.js → core/env.js | 全部 9 个编译器 + pipeline | ~14 文件 |
| sourcemap.js → core/sourcemap.js | 6 文件 | ~6 |
| compatibility.js → core/ | 4 文件 | ~4 |
| expression-parser.js → core/ | view-compiler 内部 | ~1（随函数迁移） |

### 迁移方法

```sh
# L0 的 git mv + import 更新（示例）
git mv src/compiler/wxml src/compiler/view/wxml
git mv src/compiler/view-compiler.js src/compiler/view/index.js  # 内容零变更
git mv src/compiler/logic-compiler.js src/compiler/logic/index.js
git mv src/compiler/style-compiler.js src/compiler/style/index.js
git mv src/compiler/env.js src/compiler/core/env.js
# …（归属表穷举）
# 函数级拆散（view/index.js → wxml/transform/ 等子域文件）
# stage-channel.js WORKER_ENTRY 映射
# 12 spec import 更新
```

**注意**：view-compiler.js 的函数拆散不是 git mv（单文件 → 多文件），需按归属表**函数级剪切**到子域文件——但每个函数体逐字不变。

## 决策记录（已拍板 · 2026-09-15）

| ID | 决策 |
| --- | --- |
| D-CL-1 | expression-parser → core/ |
| D-CL-2 | 编排入口 → view/index.js |
| D-CL-3 | Action 名 fe-tools-compiler-layering 转正 |

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | v1 成稿：WORKER_ENTRY 映射、import 更新范围表、迁移方法、函数级剪切说明 |