# FE Tools Bundler Output Pure

- Action: `fe-tools-bundler-output-pure`
- Status: `draft`
- Updated: 2026-09-16
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-bundler-emit-layer`](../_archive/complete/fe-tools-bundler-emit-layer/README.md)（刀 1 emit 抽取已归档；output.write 双路径，collectOutput=false 死路径）；`fe-tools-build-model`（materialize 主线程刷盘）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-16 | **立项 + 方案 C 拍板**：output 最纯（worker 无 fs）；output.write→postEntry；emitEntry 删 outputEnv；materialize 不动；memfs 拆阶段 2 另立。拆自原 emit-memfs（两阶段切分） |
| 2026-09-16 | **Review R1（F1-F4）修正**：F1 🟠 plan step3-5 补 onMessage 解构参数 `collectOutput: collectFlag` 清理；F2 🟠→修正 D-E-10 outputEnv 载体演进（非废止）→ 声明 D-OP-1 接口演进 + architecture-notes 回流标注；F3 🟡 补 outputCount 对账保留（D-OP-2）；F4 🟡 消融因果链修正（materialize 写空盘，非名不副实）。**升 `ready`** |
| 2026-09-16 | **Review R2（F1-F2）修正**：F1 🟠 D-OP-2 补 style 路径（不经 emitEntry，postEntry 后 outputCount++）+ 三引擎/plan 显式区分「删 collectOutput，保留 outputCount」（名字相似勿混）；F2 🟡 design emit.js 代码块补 import postEntry 标注。**升 `ready`** |
| 2026-09-16 | **Review R3（F1-F3）编号规范 + grep 准确性**：F1 🟠 README 病症 P-OP1/P-OP2 vs validation P-OP0..5 同前缀撞车 → validation 改两位 P-OP00..05（对齐 emit-layer P-E01 风格）；F2 🟡 P-OP00 grep 描述修正（删后 collectOutput 整个消失，不只 `.*false`）；F3 🟡 design §3 行为 0 补 outputCount 对账不变。**升 `ready`** |
| 2026-09-16 | **Review R4（F1-F2）文档对齐**：F1 🟡 acceptance Non-acceptance 补「刀 2 失效查询」（vs README Non-goals 4 项对齐）；F2 🟡 design 三引擎改后补 onMessage 解构参数 `collectOutput: collectFlag` 清理（plan 已有，design 漏）。**升 `ready`** |
| 2026-09-16 | **Review R5 收敛**：零发现——R1-R4 修正后全量终检通过（签名/编号/决策/行为 0/职责分层/文件覆盖/Non-goals 对齐）。5 轮收敛（output-pure 是 emit-layer 子集，范围小收敛快）。**升 `ready`，停止 review** |
| 2026-09-16 | **实施授权 + 方案 C 证伪**：授权 in_progress 后实施——删 output.write 直写路径（collectOutput=false）+ write→postEntry + 删三引擎 collectOutput 全链路。**4 组产物 diff=0（build 对拍通过），但 vitest 40 测试崩溃**（`TypeError: Cannot read properties of null (reading 'postMessage')`）。根因：**collectOutput=false 不是死路径**——40 个测试在主线程直接 import worker 模块（不经 stage-channel new Worker），parentPort 是 null，原来靠 collectOutput=false → writeFileSync 直写路径把产物落盘；删了直写路径 → postEntry 只 postMessage → parentPort null 崩溃。**R1 实证疏漏**：只 grep 了 build-pipeline 的 runCompileStage 调用（都传 onOutput → collectOutput=true），漏了测试直连场景。代码已回退 baseline（584/584 全绿）。**方案 C 证伪**——collectOutput=false 是测试直连的活路径，不能删 |
| 2026-09-16 | **根因深挖 + 方案转向**：证伪后摸排发现——collectOutput 是**线程调度知识泄漏进业务逻辑**的结晶（output.write 读调度 flag 做 if 分叉）；同构问题在 compatibility.js 的 `warnOnce`（`isMainThread` 分叉日志路由）。两个泄漏面同构，都是"worker 信息怎么回主线程"的调度知识泄漏。**output-pure 目标（output 纯化）实为更大问题（线程调度与业务逻辑混合、无收敛面）的子集**。完成摸排总报告 `docs/actions/fe-tools-worker-runtime/research.md`。**output-pure 降回 draft 暂停**，待 worker-runtime complete 后评估（目标若被 worker-runtime 包含则关闭 superseded） |

## 问题陈述

刀 1（emit-layer）完成后，`output.write` 混了两个职责：

```js
export function write({ entry, collectOutput, writeDir }) {
	if (collectOutput) {
		parentPort.postMessage({ type: 'output', entry })  // 路径 A：消息回传（无 fs 副作用）
		return
	}
	// 路径 B：直写盘（mkdir + writeFileSync，有 fs 副作用）
}
```

### 病症一（P-OP1）：collectOutput=false 是死路径

- `stage-channel.js:91` `collectOutput = typeof onOutput === 'function'`
- build-pipeline 所有 runCompileStage 调用都传 `onOutput: ctx.buildModel.add` → collectOutput 恒 true
- 测试无直连 worker 场景 → 路径 B（直写）零调用方
- output.write 的 `mkdir + writeFileSync` 分支是兼容残留（注释"供直连 worker 场景使用"实际无人用）

### 病症二（P-OP2）：output.write 双职责违背纯度

- 路径 A（postMessage）无副作用；路径 B（writeFileSync）有 fs 副作用
- 一个函数混两个语义，collectOutput 标志位分叉——与 D-E-2（策略函数注入，非标志位 if）精神矛盾
- worker 侧本应"无 fs"，但 output.write 持有 fs import + 直写逻辑

## Goal（阶段 1：worker 无 fs / 干净的 output）

**方案 C（拍板）**：output.js 最纯——删直写路径，worker 侧只剩 postMessage；写盘 100% 归主线程 materialize。

- `output.js`：`write` → 改名 `postEntry`，只收 `{entry}`，只 postMessage，删 fs/path import
- `emit.js`：emitEntry 删 outputEnv 第二参数（D-E-10 的 outputEnv={collectOutput,writeDir} 在 C 方案下全空，死参数）
- 三引擎：删 worker 全局 `collectOutput` 变量 + emitEntry 调用去 outputEnv + style write→postEntry
- stage-channel：删 collectOutput 字段（onOutput 机制保留）
- materialize：**不动**（mkdir+writeFileSync 独占写盘）

**拍板**：
1. outputEnv 删（emitEntry 签名 `emitEntry(params)`，无第二参数）
2. write → postEntry（名实相符）

## 两阶段切分

| 阶段 | 目标 | Action |
| --- | --- | --- |
| **阶段 1（本 Action）** | worker 无 fs——output 纯 postEntry，写盘 100% 归 materialize | 本 Action |
| **阶段 2（后续另立）** | dev memfs——materialize + dev server 改造 | 另立 Action |

**前置关系**：worker 无 fs 是 memfs 的前提——只有 worker 侧彻底干净，materialize 才是唯一写盘点，memfs 才有单一边界。

## Non-goals

- memfs（materialize + dev server）——阶段 2 另立
- cache（刀 3 ModuleCache）+ 目录归置——依赖 cache 家拍板，另立
- 刀 2 失效查询——独立先行
- materialize 重构（本 Action 不动 materialize，只删 worker 侧直写路径）
