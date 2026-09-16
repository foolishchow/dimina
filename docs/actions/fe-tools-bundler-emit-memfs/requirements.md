# Requirements — fe-tools-bundler-emit-memfs

Status: **draft（立项 · 2026-09-16）** — 拍板链未走完；R-* 编号待拍板后回填。

## R-MM0（待拍板）产物面出口边界

- 定义「产物面统一出口」的完整范围：output.write（worker）+ materialize（主线程）+ 漏网点（app-config/publish）哪些收口、哪些保持分层。
- 依赖拍板链第 4 步。

## R-MM1（待拍板）dev memfs

- dev 模式产物不落盘：materialize dev 跳过；dev server 从内存直读产物。
- 方案 1（候选）：dev server 直读 BuildModel.entries（已是内存 Map）；零新依赖。
- 方案 2：memfs Volume 后端；引入依赖 + 双份内存冗余。
- emit 层（emitEntry + output.write）零改动。

## R-MM2（待拍板）目录归置

- emit.js + output.js 是否单独出 `compiler/emit/`，由 cache 的「家」决定：
  - cache 落 worker → emit + output + cache 聚 `compiler/emit/`
  - cache 落主线程 → 产物面横跨 compiler + model，保持分层
- 现状 2 文件先不动，避免挪两次。

## R-MM3（待拍板）cache 的「家」（仅拍板，不实现）

- ModuleCache 落主线程 ProjectStore 侧（长驻 + IPC 回填）vs worker 内跨任务保留（零 IPC）。
- 本 Action 只拍板形态分叉，cache 实现另立刀 3 Action。

## R-MM4（MUST）行为 0

- build 模式产物字节不变（dev memfs 改造不触碰 build 路径）；vitest 全量绿。
- emit 层零改动（D-E-7/D-E-9 契约稳定）。
