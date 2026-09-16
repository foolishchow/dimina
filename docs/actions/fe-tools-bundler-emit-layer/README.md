# FE Tools Bundler Emit Layer

- Action: `fe-tools-bundler-emit-layer`（刀 1）
- Status: `ready`
- Updated: 2026-09-15（R9 编号统一；D-E-1..12 全五件套一致；实施未授权）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：`fe-tools-build-model`（M1 materialize 唯一写盘出口——但只覆盖 collectOutput 路径）；`fe-tools-compiler-target`（形态层/两段式）；[`fe-tools-wxml-refactor`](../_archive/complete/fe-tools-wxml-refactor/README.md)（renderer 抽象先例）；`fe-tools-project-store`（PS2 唯一活图权威）
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

### 病症一（P-E1）：三引擎产物样板重复，materialize 名不副实

view / logic / style 各自实现「模块集合 → modDefine 包裹 → transform → 写盘/materialize」，重复 ~100+ 行：

```text
view  : outputDir mkdir + modDefine + moduleRanges + 整包 transform + write × 4
logic : outputDir mkdir + modDefine + 逐模块 transform + write × 3
style : outputDir mkdir + write × 2（CSS/map）
```

`build-model.js` 声称 "materialize() 是唯一写盘出口"，但**非 collectOutput 路径仍在三引擎直接 fs.writeFileSync**（共 9 处）——注释与现实不符。

### 病症二（P-E2）：产物生成是手写拼接，无可增量结构

产物逻辑散在 compileML / writeCompileRes 内部，与模块收集（scriptRes/compileRes）耦合。无法：
- 独立于模块来源复用产物生成（renderer / platform / HMR 的挂点缺失）
- 从「模块集合」按 page/subpackage 重组产物（未来增量/HMR 需要）

## Goal

抽取 `pipeline/emit.js` 通用 emit 骨架，达成：

1. **模块集合接口契约**：`iterable<{moduleId, code, map}>`——emit 的输入规约（供未来 ModuleCache 实现同形状提供，见 TODO C 刀 3）。
2. **emitEntry 骨架**：遍历 → modDefine 包裹 → transform（策略注入）→ sourcemap 路径 → 出口。**差异参数化，不塞 if**：
   - transform 策略：`'bundle'`（view 整包，moduleRanges 行定位）vs `'perModule'`（logic 逐模块）——**函数注入**防伪抽象
   - target/platform：esTarget.view/browser vs logic/neutral
   - filename/entryId/relPrefix 规则
   - sourcemap rebase（logic 的 sources rebase 可选参数）
3. **emitOutput 唯一落盘口**：`collectOutput ? postMessage(M1) : fs`——消三引擎 9 处直写 + 各自 mkdir；**修复 materialize 名不副实**（直写路径收进 emitOutput）。
4. **行为 0**：三引擎接入 emit 骨架后，产物字节不变（同参同产）——纯重构。

## Non-goals

- 不做 ModuleCache（TODO C 刀 3——emit 只定义接口，缓存后做提供者）
- 不做失效查询改造（TODO C 刀 2）
- 不统一 transform 粒度（view 整包 vs logic 逐模块各有原因，差异留参数）
- 不优化产物（不顺手 tree-shaking / 共享 chunk / 改 bootstrap 语义）
- 不动模块收集（scriptRes/compileRes 维持现状作为提供者 A0）
- `fe/packages` 零触碰

## 边界

```text
本 Action（刀 1）:  emit 抽取 —— 契约 + 消费端（行为 0）
后续另立（TODO C）: 刀 2 失效查询 / 刀 3 ModuleCache（提供端 + 增量闭环）
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **E1 emit 骨架** | `pipeline/emit.js`：模块集合契约 + emitEntry + emitOutput；三引擎接入 | **行为 0**：产物 diff=0（view/logic/style 三链）+ 全量 vitest；接口成文（模块集合形状） |
| **E2 出口统一** | emitOutput 唯一落盘口（collectOutput/fs 合一）；materialize 名不副实修复 | 三引擎零直接 writeFileSync（grep 锚定）；collectOutput 与直写两路径产物一致 |

## 决策记录（讨论收敛 · 2026-09-15，draft 待拍板）

| ID | 决策 |
| --- | --- |
| **D-E-1** | emit 输入 = **模块集合接口**（iterable<{moduleId, code, map}>）——契约先立，缓存后做提供者（解耦刀 1/刀 3） |
| **D-E-2** | transform 策略 = **函数注入**（bundle/perModule 各自实现 transform+错误定位），非标志位 if（防伪抽象） |
| **D-E-3** | emitOutput 统一出口（postMessage(M1)/fs），消 9 处直写 + 各自 mkdir |
| **D-E-4** | 契约不含 deps（依赖留图维度 1，单一职责） |
| **D-E-5** | 这一刀**只搬不优化**——不统一 transform 粒度、不改产物语义 |
| **D-E-6**（拍板） | contract = `{moduleId, code, map}`，**不含 range/sourceFile**——错误定位是产物布局（bundle 策略私有，moduleRanges 由策略维护）；source 在 map 内（logic sourcemap rebase 已读 module.map.sources） | 原待定 ① |
| **D-E-7**（拍板） | `emitOutput` 独立为 **`pipeline/output.js`**（emit 无副作用 / output 有副作用；未来刀 3 增量写盘、style、materialize 对接均复用）；emitEntry 内部调用它 | 原待定 ② |
| **D-E-8**（拍板） | **style 只收 output（写盘出口），不进 emitEntry**——无模块集合/无 modDefine/无 transform，硬套骨架=伪抽象；写盘样板仍收（9 处直写的 2 处，materialize 修复才彻底） | 原待定 ③ |

## 待定

无（D-E-1..8 已全拍板）；Readiness 五件套补齐后升 `ready`

## Status / 授权

- 当前 **`ready`**：五件套齐（R-E\* / E1/E2 门 / P-E\*）；**实施未授权**（须另授 `in_progress`）

## 闭合条件

- E1/E2 交付；A-\* 全 pass；行为 0（三链 diff=0）；接口契约回流 architecture-notes（供刀 3 ModuleCache 守约）
- STATUS/归档一致；`fe/packages` 零污染

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 初稿：来自三刀方案 C 的刀 1（emit 抽取）；三病症（样板重复 / materialize 名不副实 / 无可增量结构）；D-E-1..5；3 待定 |
| 2026-09-15 | **待定拍板 → D-E-6..8**：contract 不含 range/sourceFile（错误定位留 bundle 策略）；emitOutput 独立 `pipeline/output.js`（emit 无副作用）；style 只收 output 不进 emitEntry（无模块体系，防伪抽象）。**待定清空，升 `ready`** |
| 2026-09-15 | **R1-R8 review 收敛**（详见 git log）：设计盲点→参数面/协议→文档一致性→签名→方案 A→五件套同步→清理+编号统一。最终签名见 design §7；决策表 D-E-1..12 见 §8。 |
| 2026-09-15 | **Review R9（F1-F5）编号统一**：F1 🟠 四件套 16 处旧 review 编号→D-E-*（与 design §8 一致）；F2 🟡 requirements 补 D-E-3/4 引用；F3 🟡 五件套 Status "R8"→R9；F4 🟡 design §2 emitEntry 标注省略（→§7 签名）；F5 🟡 README R8 行并入合并行。**升 `ready`** |
