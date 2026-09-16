# FE Tools Bundler Emit Memfs

- Action: `fe-tools-bundler-emit-memfs`
- Status: `draft`
- Updated: 2026-09-16
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-bundler-emit-layer`](../_archive/complete/fe-tools-bundler-emit-layer/README.md)（刀 1 emit 抽取已归档；output.write 收 worker 三引擎，D-E-7/E-9 为「只产不写」演化留口）；`fe-tools-build-model`（M1 BuildModel + materialize）；`fe-tools-session-unify`（dev server）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

刀 1（emit-layer）完成后，`output.write` 收了 worker 侧三引擎（view/logic/style）的 code/map 写盘。但产物面写盘仍分散：

```text
worker 侧：  view/logic/style code+map  → output.write ✅（刀 1）
主线程侧：   BuildModel.entries 刷盘    → materialize ❌（dev 模式实际写盘点）
             app-config.json           → config-compiler 直写 ❌
             发布 copy                 → publishToDist ❌
```

**两层互补**：`output.write`（worker 出口）与 `materialize`（主线程出口）不重复——dev 模式 `collectOutput=true` 时 worker 全 postMessage → BuildModel → materialize 刷盘（output.write 只 postMessage 不写盘）；build 模式 `collectOutput=false` 时 worker 直接 output.write 写盘（materialize 收空 BuildModel no-op）。

### 病症一（P-MM1）：dev 模式产物落盘无 memfs

dev server 产物读取走 `fs.readFile(serveRoot/...)`（dev-server.js L150-168），serveRoot = targetPath = materialize 写盘点。dev 模式产物必须先落盘才能 serve，无内存直读路径。真机/热更新延迟来自落盘 + 读盘往返。

### 病症二（P-MM2）：产物面写盘未统一收口

`materialize`（主线程刷盘）、`app-config.json`（config-compiler 直写）、`publishToDist`（发布 copy）三处漏网点未纳入统一产物面出口。dev memfs 改造需先定义「产物面出口」的完整边界。

### 病症三（P-MM3）：产物面目录未归置

emit.js + output.js 在 `compiler/pipeline/`（与编排面 build-pipeline/stage-channel/compile-target 混着）。产物面文件将随 cache/memfs 扩张，需决定是否单独出 `compiler/emit/`——但归置方向依赖 cache 的「家」（主线程 vs worker）。

## Goal

dev 模式产物不落盘（memfs），产物面写盘出口统一收口，目录归置完成。

**关键约束**：emit 层（emitEntry + output.write）零改动——D-E-7/D-E-9 已为「只产不写」演化留口。改造主战场在 materialize + dev server + BuildModel。

## 拍板链（draft 阶段设计任务）

> memfs / cache / 目录归置 / 漏网点 四者耦合，需按序拍板。

1. **拍 cache 的「家」**（主线程 ProjectStore 侧 vs worker 内跨任务保留）——形态分叉点，决定 cache.js 落 `model/` 还是 `compiler/`，进而决定 emit/output 是否单独出 `compiler/emit/`
2. **拍 memfs 方案**（方案 1 直读 BuildModel vs 方案 2 memfs Volume 后端）
3. **定目录归置**（是否出 `compiler/emit/`，由 cache 家决定）
4. **定漏网点收口范围**（app-config.json / materialize / publishToDist 哪些进产物面统一出口）

## Non-goals

- 刀 2 失效查询（DependencyGraph.getInvalidatedModules）——独立先行，不与产物面耦合
- 刀 3 ModuleCache 的失效/增量逻辑——本 Action 只拍 cache 的「家」（影响目录归置），cache 实现另立
- transform 粒度统一 / tree-shaking
