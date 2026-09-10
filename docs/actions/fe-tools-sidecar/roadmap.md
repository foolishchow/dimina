# Roadmap — fe-tools-sidecar (umbrella)

门的内容以 [README](README.md) 为准（含 **TS-0 冻结决策 D-TS0-***）。

## 门与依赖

```text
TS-0 冻结（分支 / 复制源 / bundler+web-container-sdk / dimina-cli / 终态 B）+ workspace
        │
        ▼
TS-1 意图：整包复制冒烟
        │  （由独立 Action fe-tools-bootstrap-copy 交付，非本伞子门）
        ▼
        ├────────────→ TS-4 终态 B 门禁闭环
        │
        ▼
TS-2 tools/bundler 内模板管线（parse / IR / webview）
        │
        ▼
TS-3 编排可选拆包 + web-container-sdk 深改（按需）
```

## 门清单

| 门 | 内容 | 子 Action 要求 | 就绪前置 | 状态 |
| --- | --- | --- | --- | --- |
| TS-0 | 冻结 D-TS0-1..6；`tools/*` workspace | 决策已落 umbrella README；workspace PR 可随 TS-1 | 无 | **D-TS0-1..6 已冻结**；workspace 文件实施 pending |
| TS-1 | 整包复制改名接线冒烟（意图） | **不立子门**。由独立 Action [`fe-tools-bootstrap-copy`](../_archive/complete/fe-tools-bootstrap-copy/README.md) 交付；伞只把它当**前置**，不父子验收 | 该 Action `complete` | **前置已 complete** |
| TS-2 | 在 `@dimina/bundler` 内切开 parse→IR→webview | `fe-tools-template`（未来） | bootstrap-copy complete；IR 草案 | pending |
| TS-3 | 可选抽出薄编排包；sdk 仅在 `@dimina/web-container-sdk` 内深改 | 可选未来 Action | bootstrap-copy complete | pending / 可 deferred |
| TS-4 | `fe/packages` 相对 upstream 无私有 improve diff；`dimina-cli` 仍 work；同步节奏成文 | 未来 Action 或并入伞验收 | bootstrap-copy complete | pending |

## 与已归档工作的关系

| 已归档 | 本 umbrella 态度 |
| --- | --- |
| A1 / CF-4 | 能力随 **复制进** `@dimina/bundler` 的快照走；干净 packages 保留上游/已合入面 |
| A2 / A2.0 | 预览由 `dimina-cli`（bundler）+ web-container-sdk 资产承载 |
| A3 HMR | 随复制关系保留在私有树；再改造在 tools 内 |
| A4 / CF-1..3 | packages 侧保持上游合同；管线深化在 `@dimina/bundler` 内做 |

## 治理规则

- 禁止 `packages/*` 依赖 `@dimina/bundler` / `@dimina/web-container-sdk` / `tools/*`。  
- 复制必须 VENDOR 元数据；禁止在 improve 源分支上继续叠 sidecar 大改（D-TS0-2）。  
- `@dimina/bundler` 的 description 必须含「非通用 JS bundler」释义（D-TS0-4）。
