# Roadmap — compiler-improvement (umbrella)

门的定义、内容与验收细则以 [RFC §5](../../Compiler-Architecture-RFC.md) 为准；本文只记录顺序、依赖与子 Action 治理要求。

## 门与依赖

```text
A1 hook 层 ──→ A2.0 资产分发定案 ──→ A2 dev server + L1 ──→ A3 HMR L2/L3 ──→ A4 target 抽象
                     │                                                (A4 可与 A3 并行)
                     └──（不依赖 A1，可与 A1 并行评估）

B0 基线 ──→ B1 sourcemap ──→ B2 缓存/依赖图 ──→ B3 watch ──→ B4 view 管线   （整体解耦，可延后）

C1 Lynx PoC（依赖 A4；可选，另立 RFC 后再 formalize）
```

## 门清单

| 门 | 内容 | 子 Action 要求 | 就绪前置 | 状态 / 结论 |
| --- | --- | --- | --- | --- |
| A1 | Listr 任务树抽为可挂载生命周期，行为零变化 | `compiler-hook-layer` | 无（可最早开工） | **complete（2026-09-08）**；12 事件契约 v1 已冻结并回写 RFC §4.4；A2/A4 通过内部 `options.lifecycle` 接入，不得扩大为公开 exports |
| A2.0 | container-sdk 资产分发决策（随包分发 vs peer dep） | 决策记录并入 RFC D2，不需独立子 Action | 无 | **complete（2026-09-08 定案：预构建 dist 随 compiler 包分发）**；依据：全部 `@dimina/*` workspace 包 private 不可发布 → peer dep 不成立；sdk dist 除 mitt 外自包含；离线模拟验证通过（见 RFC D2） |
| A2 | dev server + 内置宿主页 + 代理 + ws + L1 | `dmcc-dev-server` | A1、A2.0 | pending；子 Action `ready` 后可开工（A1/A2.0 前置已解除） |
| A3 | L2 CSS 热替换 + L3 模板热重挂（render/container-sdk dev-only 扩展） | `hmr-l2-l3` | A2；L3 需先过 RFC 假设 1 验证 | pending |
| A4 | view/style 按 target 分叉（首个实现 `webview`） | `render-target-abstraction` | A1（可与 A3 并行） | pending；依赖 A1 事件契约 v1 |
| B0–B4 | Rust 宿主各步（见 RFC §5） | 每步独立子 Action；整轨可 `deferred` | B 轨道终局决策（R-009） | pending / deferred decision |
| C1 | Lynx PoC | 先另立 RFC，再评估是否 formalize | A4；另立 RFC | optional / pending |

## 治理规则

- 子 Action 进入 `ready` 前必须通过 RFC 定稿检查（本 umbrella 的 Readiness gap 1 解除）。
- 每个门的验收证据记录在子 Action 的 validation 文件中；umbrella 的 [acceptance](acceptance.md) 只登记跨门/最终项。
- 门完成顺序允许局部并行（如 A2.0 与 A1），但 A2 之后的顺序调整需更新本表并回改 RFC §5。
