# Requirements — fe-tools-module-centric

Status: **ready（2026-09-19）** — 随 Action `ready`。伞级 MUST；子门细化自有 R-\*。

## R-MF0（MUST）Module 词汇

- 文档中使用 **Module** / **moduleId** / **Entry** / **entryId** 时，含义与 [technical-design](technical-design.md) D-MF-1..2 一致。
- **两层**：**Entry**（小程序 path）≠ **Module**（变换单位；M1 = logic）。不得把「受影响页」或 `getAffectedEntries` 表述成已完成的模块级失效。
- M1 的 `moduleId` = 今日 logic `CompileInfo.path`（D-MF-1 方案 A）；page 入口规范形迁移不进本伞/M1。

## R-MF1（MUST）子门顺序

- 近端顺序固定为：**M1 失效 → M2 结果缓存**。禁止颠倒导致缓存无上游失效集。
- 可选 emit W1（M0）可与 M1 并行讨论，但不得阻塞 M1 formalize。
- 子门必须另立 Action；本伞不授权子门改 `src`。

## R-MF2（MUST）与既有权威一致

- 遵守 Packer / Scheme 与 boundaries 落点表（D-BD-1..6）。
- 遵守 emit 模块集合契约 `{moduleId, code, map}`（emit-layer）。
- 遵守 packer-research：不在本伞或子门目标中「整包抽 Packer」。

## R-MF3（MUST）回流

- 冻结的 Module / moduleId 语义与子门终态，回流 [`docs/fe-tools/architecture-notes.md`](../../fe-tools/architecture-notes.md)。
- 不改写 session / CompileTarget / worker-runtime 已交付不变量的语义。

## R-MF4（MUST）零越权实施

- 本伞文档门期间：`fe/tools/bundler/src`、`fe/packages` 相对授权基线零 diff（除非另授子门 `in_progress`）。

## Non-requirements

- 不在本伞设计 Packer 插件 API 或拆 `env.ts` / `logic/**`。
- 不一次收敛全部 Module 对象字段（code 存 Store vs worker 等留给 M2 决策）。
- 不重开已归档 `fe-tools-module-cache` 的缩 scope 结论；M2 新立。
