# FE Tools Bundler Output Pure

- Action: `fe-tools-bundler-output-pure`
- Status: `draft`
- Updated: 2026-09-16
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-bundler-emit-layer`](../_archive/complete/fe-tools-bundler-emit-layer/README.md)（刀 1 emit 抽取已归档；output.write 双路径，collectOutput=false 死路径）；`fe-tools-build-model`（materialize 主线程刷盘）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

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
