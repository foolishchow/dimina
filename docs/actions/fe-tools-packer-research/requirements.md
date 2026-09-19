# Requirements — fe-tools-packer-research

Status: **draft（2026-09-20）**

## 问题

`@dimina/bundler` 的 4 个焊点同时扛 Packer（通用模块打包器）与 Scheme（Dimina 打包方案）两侧职责。D-BD-1..6 冻结了目录/文件级归属，但方法级切分留给本门。

## 研究问题（R）

### R-PR1（MUST）— emit.ts 方法级分析

emit.ts 的 `emitEntry` / `EmitModule` / `ModuleCollection` / `EmitEntryParams` / strategies 已泛化到什么程度？`modDefine` 包裹格式是 Packer 的输出格式注入点，还是 Scheme 不可抽的产物形状？`getWorkPath()` 依赖（perModule rebase）能否参数化？

### R-PR2（MUST）— logic/index.ts 方法级分析

logic/index.ts 的 Packer 胚（parseSync → walk → import/require 收集 → MagicString → esbuild.transform → remapSourcemap）与 Scheme 调用（`getDependencyGraph` ×8 / `getComponent` / `getAppId` / `resolveAppAlias` 等）能否分离？Scheme 调用能抽成 Packer 的 hooks/callbacks 吗？

### R-PR3（MUST）— env.ts 方法级分析

env.ts 965 行、26 exports、15 文件扇入。哪些 exports 是 Packer 侧（npm/alias）、哪些是共用（graph/paths/config/identity/runtime）、哪些是 Scheme 侧（project/page/component/template）、哪些是共用基础设施（AsyncLocalStorage）？`runWithCompilerContext` 归谁？总线能拆成 PackerContext + SchemeContext 吗？

### R-PR4（MUST）— dependency-graph.ts 方法级分析

一份实例同时扛 Scheme 工程图（app/pages/components + file kind）与 Packer 模块边（logic import/require）。`type` 字段（app/page/component/module）和 `kind` 字段（config/view/style/logic）的语义是偶然耦合还是本质耦合？拆成两张图（ProjectGraph + ModuleGraph）后 `getAffectedEntries` 跨图遍历可行吗？

### R-PR5（MUST）— 可抽提性评估

逐焊点给出：容易 / 需接口设计 / 极难 / 不值得，附证据。

### R-PR6（MUST）— 提取序列建议

如果值得提取，哪个焊点先拆？依赖顺序是什么？哪个可以不拆？

### R-PR7（MUST）— Packer API 草案

给出 extracted Packer 的 TypeScript interface 草案（非实现），含：模块标识、模块图、transform、模块产出的接口形状。

### R-PR8（MUST）— 决策建议

值得做 / 不值得做？附证据。如果值得做，估粗略工作量（S/M/L）。

### R-PR9（MUST）— 风险清单

行为 0 风险、测试覆盖风险、回归风险。逐项列出，附影响评估。

## 约束

- research only — 不改产品代码
- D-BD-1..6 不变
- 行为 0 前提 — 任何未来提取必须保持字节完全相同输出
- 敢说「不值得」 — 如果投入产出比不划算，明确给出

## 非范围

- 不实施 Packer 提取
- 不设计插件钩子最终 API
- 不碰 view/style 车道
