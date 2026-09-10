# Technical Design — es-target-unification（仅 logic）

> 契约状态：**已冻结（v1，2026-09-10）**。Readiness Review verdict `pass`：切片 **仅 logic**；D-CF3-1..5 全按建议。前置 CF-1/CF-2 complete。变更需同步 requirements / acceptance / README。

设计基线（2026-09-10，CF-2 已归档）：

| 位点 | 现状 |
| --- | --- |
| logic bundle minify | `target: [activeCompileConfig.esTarget.logic]`（缺省 es2023） |
| logic 单模块 CJS | **硬编码** `target: 'es2020'`（CF-1 D-CF1-3 有意推迟） |
| view esbuild | `target: [activeCompileConfig.esTarget.view]`（缺省 es2020） |
| `DEFAULT_ES_TARGET` | `{ logic: 'es2023', view: 'es2020' }` |

## 0. 冻结决策（D-CF3-1..5）

| ID | 决策点 | 冻结值 |
| --- | --- | --- |
| D-CF3-1 | 本门切片 | **仅 logic 收敛**；**不含** view 抬升；无 WebView/Harmony 阻塞 |
| D-CF3-2 | CJS 接线 | 单模块 CJS `esbuild`/`transform` 的 `target` → `activeCompileConfig.esTarget.logic`（字符串或与现 API 一致的形式） |
| D-CF3-3 | 缺省值 | **不改** `DEFAULT_ES_TARGET`；不改 view 接线 |
| D-CF3-4 | 产物验收 | view/style：**diff=0**；logic：允许因 CJS 对齐产生 delta，validation 必须记录；`esTarget.logic:'es2020'` 覆盖须生效 |
| D-CF3-5 | Acceptance / 消融 | A-001..A-008；消融「CJS 读 logic」契约（恢复硬编码 es2020 → 规格失败） |

## 1. 问题

logic 车道内两处 target 不一致：

```text
bundle minify  → esTarget.logic (es2023)
单模块 CJS     → 字面量 es2020     ← 同车道漂移（缺陷）
```

view 保持 es2020 是架构约束，不是本门要消掉的「不一致」。

## 2. 改动面（最小）

**只改** `fe/packages/compiler/src/core/logic-compiler.js` 单模块 CJS 路径：

```js
// before
target: 'es2020',

// after
target: activeCompileConfig.esTarget.logic,
```

（若该 API 需要数组形式，与同文件 bundle 路径对齐。）

删除或改写 `// CF-3: ...` 占位注释为「已接线」说明。

**不改**：`view-compiler.js`、`compile-config.js` 缺省、`platforms.js`、bin CLI（本门不新增 `--es-target-*`）。

## 3. 规格

新增或扩展：

- 单元/契约：mock 或注入 `compileConfig.esTarget.logic`，断言 CJS `transform` 调用的 `target` 为该值（若现有测试可 spy esbuild；否则源码契约 + 覆盖 build 抽样）。
- 回归：全量 `vitest`；实施后对 `examples/miniprogram/base` 做基线对照（分 view/style vs logic）。

推荐消融点：把 CJS `target` 改回字面量 `'es2020'` → 「必须读 esTarget.logic」规格失败。

## 4. 文件落地

- 修改：`src/core/logic-compiler.js`
- 测试：`__tests__/`（logic / compile-config 相关或新建 `logic-es-target.spec.js`）
- 闭合：RFC 短回写（§4.7 或邻近：logic 车道已收敛；view 抬升未做）

## 5. 与相邻门

- **CF-1**：双字段与缺省已定；本门完成 D-CF1-3 遗留
- **CF-2**：platform 与本门正交
- **后续**：若要抬 `esTarget.view`，另开切片/Action + WebView 矩阵，不得混入本门闭合

## 6. 备选与取舍

- **本门同时抬 view→es2023**：否决（D-CF3-1）；阻塞矩阵，违背「仅 logic」授权
- **把 DEFAULT logic 改回 es2020 以保全局 diff=0**：否决——与 CF-1 缺省及 bundle 已用 es2023 冲突；正确做法是 CJS 对齐 logic
- **新增 CLI `--es-target-logic`**：否决（克制）；API `options.esTarget` 已足够
