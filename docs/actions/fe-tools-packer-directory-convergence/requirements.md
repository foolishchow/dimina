# Requirements — fe-tools-packer-directory-convergence

Status: **draft（2026-10-09）**

## 背景

packer 架构 retrospect（[F-PA-1..6](../../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)）发现 packer 域逻辑散在 4 处（`packer/` + `model/` + `compiler/pipeline/` + `compiler/worker-runtime/`）+ `compiler/core/` 混合袋。散落致跨层 import 温床（③a/b/c）+ D/C 重构缺干净素材 + 北星 6 组件无物理落地。

## Requirements

### R-DC-1（MUST）— packer 域全部文件归位 packer/ 子目录

packer 域 ~27 文件归位 `packer/` 子目录，子目录结构 mirror 北星 6 组件形状（`graph/` / `store/` / `registry/` / `state/` / `cache/` / `emit/` / `worker/` / `pipeline/` / `aspect/`）。归位映射见 [design.draft §3](design.draft.md)。

### R-DC-2（MUST）— model/ 解散

`src/model/` 9 文件全是 packer 域（graph 内核 / cache / 失效 / store / emit 装配），命名误导。全部迁入 packer/ 对应子目录。目录删除或留空。

### R-DC-3（MUST）— compiler/pipeline/ + compiler/worker-runtime/ 解散

`compiler/pipeline/`（10 文件，全是 packer 编排，名实不符）+ `compiler/worker-runtime/`（7 文件，D-PCS-8 通用 worker 是 packer 派发机制）全部迁入 packer/ 对应子目录（`pipeline/` / `emit/` / `state/` / `worker/`）。

### R-DC-4（MUST）— compiler/core/ 解体

`compiler/core/` 混合袋解体：
- packer 域（renderers / npm-builder / env / compatibility）→ 迁 packer/ 对应子目录
- shared/compiler（sourcemap / expression-parser / compatibility-reference）→ 迁 `shared/` 或 `compiler/utils/`

### R-DC-5（MUST）— compiler/ 收敛后只剩 per-kind transforms

`src/compiler/` 收敛后只剩 `logic/` / `view/` / `style/` 三目录（per-kind transforms：parse-walk / transform / index/engine / worker-entry / registry-impl）。per-kind 子结构不动（Non-scope）。

### R-DC-6（MUST）— 行为 0（纯搬迁无逻辑改）

纯目录搬迁 + import 路径改写，**逻辑零改**（函数体不动）。行为 0 三件套：
- tsc `--noEmit` 0 error
- vitest 全绿（当前 87 files / 646 tests）
- 6 项目 one-shot `diff -r` baseline = 0（base/subpackages/mpx-demo/vant/weui/taro-todo）

### R-DC-7（SHOULD）— ③a/b/c 跨层 import 消解

同域归位自然消解 ③a/b/c（model→pipeline 反向 import）。验证：`grep -n "pipeline/" src/packer/cache/invalidation.ts src/packer/cache/compile-cache.ts src/packer/emit/convergence.ts` = 0。③b/③c 若 residual 仍存（type-only 或 runtime 无害），记 tracker 不阻塞。

### R-DC-8（MUST）— tracker + architecture-notes 同步

- tracker（`docs/fe-tools/incremental-chain-residuals.md`）：③a/b/c 状态更新（fixed / residual）
- architecture-notes：packer 目录收敛条目（子目录结构 + 北星 6 组件物理落地）
- STATUS.md / TODO.md / navigation sync

## Non-requirements（显式排除）

- D（facade + collaborator 抽取）——Round 1，本 Action 只搬目录不改结构职责
- C（aspect 分离）——Round 2
- B（ALS→PackerContext 闭合）——Round 2 后 checkpoint 评估
- compiler/logic|view|style per-kind 子结构调整——留待后续
- logicLoader 对齐 buildJSByPath（dispatch wiring，Round E，runtime 就绪后）
- 函数体/逻辑变更（纯搬迁红线，D-DC-2）

## Traceability

- F-PA-1..6（设计模式缺陷）→ 本 Action 解 F-PA 漂移温床（散落）→ R-DC-1..5
- ③a/b/c（跨层 import residual）→ R-DC-7
- 行为 0 → R-DC-6
- tracker → R-DC-8
