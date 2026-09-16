# FE Tools Bundler Emit Memfs

- Action: `fe-tools-bundler-emit-memfs`
- Status: `draft`
- Updated: 2026-09-16
- Status authority: [Action Status](../STATUS.md)
- 前置依赖：[`fe-tools-bundler-output-pure`](../fe-tools-bundler-output-pure/README.md)（阶段 1 worker 无 fs；close 后 materialize 成为唯一写盘点，memfs 才有单一边界）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

阶段 1（output-pure）完成后，worker 侧彻底无 fs，写盘 100% 收敛到主线程 `materialize`（build-model.js）。但 dev 模式产物仍落盘：

```text
dev 模式：worker → postEntry → BuildModel.add → materialize 写盘 → dev server fs.readFile(serveRoot) 读盘 serve
                                                ^^^^^^^^^^^^^^                ^^^^^^^^^^^^^^^^^^
                                                唯一写盘点                     从盘读
```

### 病症（P-MM1）：dev 模式产物落盘往返

- `materialize`（build-pipeline L181）把 BuildModel.entries 刷盘到 targetPath
- dev server（dev-server.js L150-168）`fs.readFile(serveRoot=targetPath/...)` 从盘读产物 serve
- 真机/热更新延迟来自落盘 + 读盘往返；BuildModel.entries 本身已是内存 Map，却要先落盘再读盘

## Goal（阶段 2：dev memfs）

dev 模式产物不落盘——dev server 从内存直读产物。

### 候选方案（待阶段 1 close 后拍板）

- **方案 1（候选）**：dev server 直读 BuildModel.entries（已是内存 Map）；materialize dev 跳过；dev server `resolveArtifact(path)` 从 BuildModel 查（建 path→{code} 反查索引）。零新依赖；~50 行。
- **方案 2**：materialize 写 memfs Volume；dev server fs 换 memfs 后端。dev server 逻辑不动但引入 memfs 依赖 + BuildModel/memfs 双份内存冗余。

## 拍板链（待走）

1. memfs 方案（1 直读 BuildModel vs 2 memfs Volume）
2. 漏网点收口范围（materialize dev 跳过策略 / app-config.json / publishToDist 哪些进产物面）
3. cache 的「家」（主线程 vs worker）→ 影响目录归置，可能与本 Action 耦合

## Non-goals

- 阶段 1 worker 无 fs（output-pure 已做）
- cache（刀 3 ModuleCache）实现 + 目录归置——依赖 cache 家拍板，另立
- 刀 2 失效查询——独立先行
