# Implementation Plan — fe-tools-bundler-emit-memfs

Status: **draft（立项 · 2026-09-16）** — 拍板链未走完；触达序待拍板后回填。

## 基线

- baseline 待授权时记录 HEAD。
- emit 层（emitEntry + output.write）零改动（D-E-7/D-E-9 契约稳定）。
- 行为 0：build 模式产物字节不变 + vitest 全量绿。

## 触达序（待拍板后定）

拍板链走完后按 memfs 方案 + 目录归置 + 漏网点收口范围拆 step。候选触达面（方案 1）：

- `model/build-model.js`：加 path→{code} 反查索引 + resolveArtifact
- `compiler/pipeline/build-pipeline.js`：materialize 加 collectOutput 分支（dev 跳过）
- `dev/dev-server.js`：产物路由从 fs.readFile → resolveArtifact
- `session/index.js`：dev 时传 buildModel 给 dev-server
- 漏网点收口（app-config/materialize/publish）按拍板结果决定

## 门禁

待拍板后定义。
