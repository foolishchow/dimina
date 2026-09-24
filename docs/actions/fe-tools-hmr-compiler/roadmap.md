# Roadmap — fe-tools-hmr-compiler

Status: **draft（2026-10-09）**

```text
HMR0 词汇 + 顺序（本伞 draft → ready）
        │
        ▼
H1 load/compile 分离
        │   compile-target 拆 load（graph building）与 compile（per-module）
        │   使单模块 recompile 可行
        ▼
H2 deriveFromGraph 接线
        │   production emit 从 emitBuckets 改 graph→cache→EmitModule 派生
        ▼
H3 registry 实体化
        │   Loader/Compiler/Emitter 替代 legacy compile-target（emptyRegistry → real）
        │   Packer shape（types.ts）激活
        ▼
H4 per-module HMR push
        │   runtime.ts postMessage 增量 payload + dev server 消费
        │   （依赖 runtime HMR API 协议——运行时侧）
        ▼
伞 close
```

| 门 / 子门 | 状态 | 备注 |
| --- | --- | --- |
| HMR0 本伞 | **`draft`** | 4 子门预判；design.draft 规模评估待做 |
| H1 load/compile 分离 | pending | compile-target 拆分；行为 0 |
| H2 deriveFromGraph 接线 | pending | emit 路径改 graph 派生；行为 0 |
| H3 registry 实体化 | pending | emptyRegistry → real；Packer shape 激活 |
| H4 per-module HMR push | pending | 增量 payload；依赖 runtime HMR API |

## 子门依赖序

- H1 → H2（load/compile 分离后 deriveFromGraph 才能接线——emit 集需 per-module cache）
- H2 → H3（deriveFromGraph 接线后 registry 才能实体化——Compiler registry 消费 graph 派生）
- H3 → H4（registry 实体化后 per-module push 才能走 registry 路径）
- H4 → 伞 close（per-module push 是 HMR 编译侧终点）

**runtime HMR API 依赖**：H4 per-module push 需 runtime 协议定义（运行时侧）。若 runtime API 未就绪，H4 可先交付编译侧增量 payload（dev server 暂 fallback 全量 reload），runtime 就绪后激活。
