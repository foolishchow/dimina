# FE Tools Bundler Unvite

- Action: `fe-tools-bundler-unvite`
- Status: `ready`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 关系：独立卫生 Action（**不是** umbrella 子门）。背景见 [`fe-tools-sidecar`](../fe-tools-sidecar/README.md)；闭合不依赖伞 `ready`。
- 工作分支建议：在长线 [`feature/fe-tools-sidecar`](../fe-tools-sidecar/README.md) 上直接做，或从其 tip 开短分支 `feature/fe-tools-bundler-unvite`。
- 设计权威：本目录；冻结项见 **D-UV-***。

- Draft review：2026-09-10；**2026-09-10 口头确认冻结 → 升 `ready`**（实施仍须授权）。

## Background

`@dimina/bundler`（`fe/tools/bundler`）自发布目前走 **`vite build` 库模式**（多 entry、external、输出 `dist/`）。源码已是 Node ESM（`"type":"module"`，engines ≥22），自打包并不需要通用前端 bundler：

1. Vite 过重，且会产生 chunk / 导出缩名，干扰调试与路径直觉；
2. Worker 通过 `import.meta.url` 相对加载 `core/*-compiler.js`，更适合 **稳定目录树**，而非打包图；
3. 讨论结论：**不要**用 esbuild/swc/Rollup 的 **bundler** 能力替换 Vite；自发布 **只要 ESM 树**，优先 **不打包**。

本门是工具链卫生，**不**解决编排器 / plugin / 模板 IR（那些是另一条架构线）。

## Goal

1. 下线 `@dimina/bundler` 的 **`vite build` 自打包**；
2. 采用 **无 bundler** 的 ESM 发布/运行形态（见 D-UV-1）；
3. 保持 `dimina-cli`、既有 vitest、sdk 资产复制、公开 `exports` 可解析；
4. 行为与小程序编译语义相对改造前等价（本门不改 view/logic/style 算法）。

## Non-goals

- 引入 esbuild/swc/Rollup/`tsup` 作为**自打包 bundler**；
- 本门上 TypeScript 迁移；
- 抽取 `bundler-core` / plugin API / 模板 IR；
- 移除 **vitest**（测试运行器可继续用；与「Vite 作自打包器」分离）；
- 改 `fe/packages/compiler` 的上游 Vite 自打包；
- 向 didi 推送。

## 冻结决策

| ID | 内容 | 状态 |
| --- | --- | --- |
| D-UV-1 | **自发布不打包**：不用 Vite/esbuild/swc/Rollup 做 module graph bundling；产物为 **ESM 目录树** | 冻结 |
| D-UV-2 | **落地形态**：`build` = 将 `src/**` **镜像同步**到 `dist/`（保持相对路径）+ 既有 postbuild（`copy-sdk-assets`、`check-package-exports`）。`package.json` 的 `bin`/`exports`/`files` 仍以 `dist` 为根。顺序：**sync → copy-sdk → check-exports**（若 sync 清空 `dist`，必须在消费前写回 `dist/sdk`） | **冻结**（2026-09-10） |
| D-UV-3 | **稳定导出**：新增 `src/watch.js`，再导出 `./common/watch-runner.js`；镜像后即存在 `dist/watch.js`，保持 `exports["./watch"]` 语义不变 | **冻结**（2026-09-10） |
| D-UV-4 | **Worker**：继续用 `path.join(dirname(import.meta.url), 'core/${stage}-compiler.js')`；镜像后 `dist/index.js` 旁仍有 `dist/core/*-compiler.js` | 冻结 |
| D-UV-5 | 删除（或停止使用）`fe/tools/bundler/vite.config.mjs`；`package.json` 的 `build` 不再调用 `vite build` | 冻结 |
| D-UV-6 | **`build-output` 测例**：改写 `__tests__/build-output.spec.js`，**不再** `vite.build` / 依赖 `vite.config.mjs`；改为对 **`pnpm build` 后的 `dist/core/view-compiler.js`（或镜像等价路径）** 断言无 Babel `require(...)`。仅当断言与其它门完全重复时才可删除该文件，并在 validation 成文 | **冻结**（2026-09-10，原 G3） |

备选（仅当 D-UV-2 实施证明不可行）：`bin`/`exports` 直接指 `src/`，`sdk` 另置——须更新验收后再用。

## Scope

| 纳入 | 说明 |
| --- | --- |
| `fe/tools/bundler/package.json` | `build` 脚本；exports 保持既有子路径 |
| `fe/tools/bundler/vite.config.mjs` | 移除（D-UV-5） |
| 新建小脚本（如 `scripts/sync-dist-from-src.js`） | 镜像 `src` → `dist`（D-UV-2） |
| `src/watch.js` | 再导出 `./common/watch-runner.js`（D-UV-3） |
| `scripts/copy-sdk-assets.js` | 注释/时序；postbuild 在 sync 之后 |
| `scripts/check-package-exports.js` | 仍校验；按需对齐路径 |
| `__tests__/build-output.spec.js` | 按 D-UV-6 改写（或成文删除） |
| README 工作区用法 | 注明自发布不再 Vite |

| 不纳入 | 说明 |
| --- | --- |
| `src/core/*` 编译算法 | 零行为改动为目标 |
| 全面迁移离 vitest | 非本门（仅处理依赖自打包 Vite 的用例） |
| `@dimina/web-container-sdk` 的 vite | 非本门 |

## Deliverables

- 无 `vite build` 的 bundler `build` 流水线；
- D-UV-1..6 落地；
- `pnpm --filter @dimina/bundler build` 成功；`dimina-cli --version` / 冷启动冒烟或等价；
- 既有 `pnpm --filter @dimina/bundler test` 全绿（或成文豁免）；
- acceptance / validation 证据。

## Approach

```text
1. 新增 src/watch.js（D-UV-3）
2. 实现 sync-dist；package.json build = sync → copy-sdk → check-exports（D-UV-2）
3. 删/停 vite.config.mjs；改写 build-output.spec.js（D-UV-5/6）
4. 跑 build → test → dimina-cli 冒烟 → 填 validation
5. 更新 README / copy-sdk 注释
```

## Readiness（review · 2026-09-10 → ready）

| # | Gap | 结论 |
| --- | --- | --- |
| G1 | D-UV-2 镜像 dist | **已冻结** |
| G2 | `./watch` → `src/watch.js` re-export | **已冻结**（D-UV-3） |
| G3 | `build-output.spec.js` | **已冻结**（D-UV-6：改写为断言 dist） |
| G4 | sync 与 `dist/sdk` 时序 | 实施清单：sync → copy-sdk → check-exports |
| G5 | 冒烟 argv | validation 已有草案 |
| G6 | 实施授权 | 仍须用户明确授权后再改代码 |

**Verdict**：**`ready`**。范围/非范围与 D-UV-* 已确认；待实施授权。

## Closure conditions

- acceptance 通过并有证据；  
- 包内自打包不再依赖 Vite；  
- STATUS 更新（complete 后按惯例归档）。

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | MUST |
| [acceptance](acceptance.md) | 验收表 |
| [validation](validation.md) | 计划命令（执行时填） |
