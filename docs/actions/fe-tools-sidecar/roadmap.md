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
        ├────────────→ TS-4 终态 B 门禁闭环 + 同步节奏成文
        │
        ├─（并行，非父子）→ 编排控制面：fe-tools-bundler-session（complete，已归档）
        │
        ├─（并行，非父子）→ 主线程层：fe-tools-build-model（**ready**，D-BM/D-P 冻结；Entry 产物持有 + (mtime,size) 指纹 + 失效 + 统一物化，对拍 MUST）
        ├─（并行，非父子）→ worker 内层：fe-tools-module-cache（draft；FileModule 颗粒化 + 内容寻址，**与 build-model 并行**）
        ├─（并行，非父子）→ 决策层：fe-tools-worker-architecture（**ready**，决策已冻结；协议 v1/v2 + D-WA 决策 + 时序防护）
        │
        ▼
TS-2 tools/bundler 内模板管线（parse / IR / webview）
        │
        ▼
TS-3 编排可选拆包 + web-container-sdk 深改（按需；BC-3 指针）
```

## 门清单

| 门 | 内容 | 子 Action 要求 | 就绪前置 | 状态 |
| --- | --- | --- | --- | --- |
| TS-0 | 冻结 D-TS0-1..6；`tools/*` workspace | 决策已落 umbrella README | 无 | **已冻 + 已落地**（bootstrap → 长线 `feature/fe-tools-sidecar`） |
| TS-1 | 整包复制改名接线冒烟（意图） | **不立子门**。由独立 Action [`fe-tools-bootstrap-copy`](../_archive/complete/fe-tools-bootstrap-copy/README.md) 交付；伞只把它当**前置**，不父子验收 | — | **前置已 complete** |
| TS-2 | 在 `@dimina/bundler` 内切开 parse→IR→webview | `fe-tools-template`（未来） | bootstrap-copy complete；[`fe-tools-build-model`](../fe-tools-build-model/README.md)（地基：产物持有+失效传播）；IR 草案 | pending |
| TS-3 | 可选抽出薄编排包；sdk 仅在 `@dimina/web-container-sdk` 内深改 | 可选未来 Action；控制面已由 [`fe-tools-bundler-session`](../_archive/complete/fe-tools-bundler-session/README.md) 交付（complete）；拆包更晚 | bootstrap-copy complete | pending / 可 deferred；**不阻塞本门** |
| TS-4 | `fe/packages` 相对 origin/main 无私有 improve diff；`dimina-cli` 仍 work；同步节奏成文 | 未来 Action 或并入伞验收 | bootstrap-copy complete | packages 干净已满足草案句；**同步节奏文档 pending** |

## 与已归档工作的关系

| 已归档 | 本 umbrella 态度 |
| --- | --- |
| A1 / CF-4 | 能力随 **复制进** `@dimina/bundler` 的快照走；干净 packages 保留上游/已合入面 |
| A2 / A2.0 | 预览由 `dimina-cli`（bundler）+ web-container-sdk 资产承载 |
| A3 HMR | 随复制关系保留在私有树；再改造在 tools 内 |
| A4 / CF-1..3 | packages 侧保持上游合同；管线深化在 `@dimina/bundler` 内做 |
| `fe-tools-bootstrap-copy` | TS-1 前置；已归档 complete |

## 治理规则

- 禁止 `packages/*` 依赖 `@dimina/bundler` / `@dimina/web-container-sdk` / `tools/*`（根 `fe/package.json` 的 workspace 依赖 `@dimina/bundler` 仅用于链接 `dimina-cli` bin，不算 packages 反向依赖）。  
- 复制必须 VENDOR 元数据；禁止在 improve 源分支上继续叠 sidecar 大改（D-TS0-2）。  
- `@dimina/bundler` 的 description 必须含「非通用 JS bundler」释义（D-TS0-4）。
