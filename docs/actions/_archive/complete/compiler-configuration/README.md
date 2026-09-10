# Compiler Configuration（Umbrella）

- Action: `compiler-configuration`
- Status: `complete`
- Updated: 2026-09-10
- Archived: 2026-09-10
- Status authority: [Action Status](../../../STATUS.md)
- 设计权威：[Compiler Architecture RFC](../../../../Compiler-Architecture-RFC.md)（子门回写 §4.6–§4.9、D6:B；本文不重复）

## Background

编译器配置曾散落在 CLI / API options / 内部硬编码；watch 曾为 CLI-only。本 umbrella 推动配置化：统一 compile configuration、platform、双字段 esTarget、watch API。

## Goal

1. platform 维度 + D6:B 产物分层 — **已交付（CF-2）**
2. 统一 compile configuration，CLI ⊆ API — **已交付（CF-1）**
3. `esTarget.{logic,view}` + logic 车道收敛 — **已交付（CF-1 / CF-3 仅 logic）**
4. watch API 化 — **已交付（CF-4）**

## Non-goals（仍成立）

- 新产物格式、Lynx、性能优化、改 HMR/ws 协议、配置文件
- **view 抬升**（es2020→更高）：不在已归档 CF-3 切片内；若需要另开 Action + WebView 矩阵

## Scope

- 主战场：`fe/packages/compiler`（由子门交付）
- 文档回流：`docs/Compiler-Architecture-RFC.md`

## 核心设计原则（定稿摘要）

**CLI ⊆ API**；**compile profile = f(platform, mode, override)**；**D6:B** 不变层 / 可变层；**esTarget 按双线程拆分**，不强制 logic===view。

## Roadmap（终态）

| 门 | 子 Action | 状态 | 归档 |
| --- | --- | --- | --- |
| CF-4 | `watch-api` | complete | [_archive/.../watch-api](../watch-api/README.md) |
| CF-1 | `compiler-configurable` | complete | [_archive/.../compiler-configurable](../compiler-configurable/README.md) |
| CF-2 | `platform-abstraction` | complete | [_archive/.../platform-abstraction](../platform-abstraction/README.md) |
| CF-3 | `es-target-unification`（仅 logic） | complete | [_archive/.../es-target-unification](../es-target-unification/README.md) |

执行序（实际）：CF-4 → CF-1 → CF-2 → CF-3。

## Readiness gaps

无。子门全部 complete；RFC 回流齐备（D6:B、§4.6–§4.9）。

## Closure conditions

- 全部子 Action complete（含验收证据与回流）— 已满足
- D6:B 定稿回写 RFC — 已满足（CF-2）
- STATUS、导航、归档一致 — 本闭合完成

## Closure decision（2026-09-10）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/compiler-configuration/`。
- **子门**：CF-1..CF-4 全部 `complete` 并归档；各门 A-* 与 validation（含消融）见对应归档 README。
- **RFC 回流**：v1.8–v1.11（§4.6 watch、§4.7 compile config、D6:B + §4.8 platform、§4.9 logic 收敛）。
- **明确不在本 umbrella 内**：`esTarget.view` 抬升（另立 Action + WebView 矩阵）；配置文件；Lynx。
- **残余**：各子门残余已记在各自归档；umbrella 无新增悬置项。
