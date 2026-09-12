# Roadmap — fe-tools-sidecar (umbrella)

门的内容以 [README](README.md) 为准（含 **TS-0 冻结决策 D-TS0-***）。

## 门与依赖

```text
TS-0 冻结 + workspace（已落地）
        │
        ▼
TS-1 意图：整包复制冒烟
        │  （独立 Action fe-tools-bootstrap-copy → complete）
        ▼
        ├────────────→ TS-4 终态 B 门禁闭环 + 同步节奏成文（近端可并行成文）
        │
        ├─（并行，已归档）→ fe-tools-bundler-session / build-model / module-cache / worker-architecture
        │
        ├─（已归档）→ fe-tools-bundler-layout（build/dev × session/compiler；L0–L3 complete）
        ├─（近端候选，待 formalize）→ runBuild 阶段化（行为 0 变化；非 TS-2）
        │
        ▼
TS-2 模板管线 parse → IR → webview     【deferred 2026-09-12】
        │
        ▼
TS-3 编排可选拆包 + web-container-sdk 深改（按需）
```

## 门清单

| 门 | 内容 | 子 Action 要求 | 就绪前置 | 状态 |
| --- | --- | --- | --- | --- |
| TS-0 | 冻结 D-TS0-1..6；`tools/*` workspace | 决策已落 umbrella README | 无 | **已冻 + 已落地** |
| TS-1 | 整包复制改名接线冒烟（意图） | **不立子门**。由 [`fe-tools-bootstrap-copy`](../_archive/complete/fe-tools-bootstrap-copy/README.md) 交付 | — | **前置已 complete** |
| TS-2 | 在 `@dimina/bundler` 内切开 parse→IR→webview | `fe-tools-template`（未来） | 见 README「TS-2 deferred」再激活条件 | **deferred**（2026-09-12；目标保留，近端不做） |
| TS-3 | 可选抽出薄编排包；sdk 深改 | 可选；控制面已由 session 交付 | bootstrap-copy complete | pending / 可 deferred |
| TS-4 | packages 终态 B + 同步节奏成文 | 未来 Action 或并入伞验收 | bootstrap-copy complete | packages 干净；**同步节奏文档 pending** |

## 与已归档工作的关系

| 已归档 | 本 umbrella 态度 |
| --- | --- |
| A1 / CF-4 | 能力随 **复制进** `@dimina/bundler` 的快照走；干净 packages 保留上游/已合入面 |
| A2 / A2.0 | 预览由 `dimina-cli`（bundler）+ web-container-sdk 资产承载 |
| A3 HMR | 随复制关系保留在私有树；再改造在 tools 内 |
| A4 / CF-1..3 | packages 侧保持上游合同；管线深化在 `@dimina/bundler` 内做 |
| `fe-tools-bootstrap-copy` | TS-1 前置；已归档 complete |
| session / build-model / module-cache / worker-architecture | 旁路编排与编译地基；已归档 complete |

## 治理规则

- 禁止 `packages/*` 依赖 `@dimina/bundler` / `@dimina/web-container-sdk` / `tools/*`（根 `fe/package.json` 的 workspace 依赖 `@dimina/bundler` 仅用于链接 `dimina-cli` bin，不算 packages 反向依赖）。  
- 复制必须 VENDOR 元数据；禁止在 improve 源分支上继续叠 sidecar 大改（D-TS0-2）。  
- `@dimina/bundler` 的 description 必须含「非通用 JS bundler」释义（D-TS0-4）。
