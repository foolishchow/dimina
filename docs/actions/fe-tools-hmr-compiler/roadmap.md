# Roadmap — fe-tools-hmr-compiler

Status: **ready（2026-10-09）**

> **§8 修正**：H1 从「load/compile 分离」改为「deriveFromGraph 接线」（增量链已分离 load/compile）。原 H2-H3 顺延，新 H3 per-module cache 是 design.draft §1.3 新发现。

```text
HMR0 词汇 + 顺序（本伞 draft → ready）
        │
        ▼
H1 deriveFromGraph 接线（emit 增量化）
        │   emit 从 emitBuckets 全量改 graph→cache→EmitModule 派生
        │   使 emit 集 = graph 派生（非手动 bucket）
        ▼
H2 registry 实体化（compile 替代 legacy）
        │   Loader/Compiler/Emitter 替代 legacy compile-target
        │   Packer shape（types.ts）激活
        ▼
H3 per-module view/style cache（粒度反转）
        │   G5 D-G5-4' per-page-bundle → per-module
        │   使单组件 recompile → 单 module emit 可行
        ▼
H4 per-module HMR push（dev server 增量）
        │   dev-reload 加 HMR level + dev-server 增量 payload + materialize 增量化
        │   （依赖 runtime HMR API 协议——运行时侧；fallback 全量 reload）
        ▼
伞 close
```

| 门 / 子门 | 状态 | 规模 | 备注 |
| --- | --- | --- | --- |
| HMR0 本伞 | **`draft`** | — | design.draft 规模评估完成；D-HMR-2/3 design gate 待子门 formalize 锁 |
| H1 deriveFromGraph 接线 | **`complete`**（子门 [`fe-tools-hmr-emit-derive`](../_archive/complete/fe-tools-hmr-emit-derive/README.md)） | M | emit 路径重构；行为 0（emitBuckets→graph 派生字节一致）；D-ED-1 B2+E 锁（实证 pass）+ D-ED-2 locked B 确认 |
| H2 registry 实体化 | **`complete`**（子门 [`fe-tools-hmr-registry-materialize`](../_archive/complete/fe-tools-hmr-registry-materialize/README.md)） | L+ | 替代 legacy compile-target；**F-H2-1 viewParseWalk/buildCompileCss monolithic 须拆分 L/C/E 三阶段**；D-REG-1/2/3 locked（渐进非 dual-path + load 在 domain + stage 保留） |
| H3 per-module view/style cache | **`complete`**（子门 [`fe-tools-hmr-per-module-cache`](../_archive/complete/fe-tools-hmr-per-module-cache/README.md)） | M-L | G5 per-page-bundle 反转；D-PMC-1 stored order metadata locked（actual probe PASS 3 项目 + vant 4.86x dedup）+ per-module invalidation |
| H4 per-module HMR push | **`ready`**（子门 [`fe-tools-hmr-push`](../fe-tools-hmr-push/README.md)） | M | runtime 协议依赖；D-PUSH-1/2/3 locked（L_HMR payload + runtime-side downgrade fallback L1 + materialize 增量 + publishToDist 重构 F-H4-2）；非阻塞伞 close |

## 子门依赖序

- H1 → H2（emit 路径已 graph 派生后，registry compile 侧才能接）
- H2 → H3（registry 实体化后 per-module compile 路径就绪，view/style 粒度才能反转）
- H3 → H4（per-module cache 就绪后，HMR push 才有 per-module 粒度数据）
- H4 → 伞 close（per-module push 是 HMR 编译侧终点）

**runtime HMR API 依赖**：H4 per-module push 需 runtime 协议定义（运行时侧）。若 runtime API 未就绪，H4 可先交付编译侧增量 payload（dev server 暂 fallback L1 page-level reload），runtime 就绪后激活 L_HMR per-module hot-swap。
