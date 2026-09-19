# Requirements — fe-tools-module-result-cache

Status: **草案（2026-09-20）** — 随 Action `draft`；设计待定项未冻。

## R-RC0（MUST）遵守伞 D-MF-1 / D-MF-2

- cache key = `moduleId` = logic `CompileInfo.path`（方案 A；与 M1 一致）。
- 缓存宿主**不挂图节点**（D-MF-2）；另定宿主（待 RC0 拍板）。
- 不改 emit / runtime id；不拆 `DependencyGraph` 结构。

## R-RC1（MUST）跨 rebuild 缓存

- 缓存 logic `CompileInfo`（`{path, code, map, extraInfoCode}`）。
- rebuild 时消费 M1 `computeInvalidatedModules(graph, changedFiles)` → 脏集 → 清缓存 → 只重编脏模块。
- clean 模块命中缓存，跳过 transform。

## R-RC2（MUST）可观测验证

- watch 冒烟：改 1 JS 文件 → 只重编该模块 + 其 logic dependents；clean 模块不重编。
- 全量 vitest 绿；产物 diff=0（仅加法，不改 emit 字符串）。

## R-RC3（MUST）落点与边界

- 不引入 Packer 插件 API；不拆 env/logic；不改 `fe/packages`。
- watch / compile-cache 接线在本门完成（M1 明确不做 D-IV-4）。

## Non-requirements

- view / style 结果缓存（旧 module-cache 已交付 view 失败缓存 + style minify key）。
- fingerprint 下沉模块级（依赖 Module 大对象，另门）。
- HMR patch 产物（另门）。
