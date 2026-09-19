# Sync rhythm — fe-tools-sidecar（TS-4）

Status: **frozen（2026-09-12）**  
Authority: [umbrella README](./README.md) D-TS0-1 / D-TS0-2；本文件为**操作真源**。  
Scope: 文档门（无代码改造）。不授权向 didi 推送本伞交付物（R-010）。

## 1. 终态 B 可检查句（最终）

工作分支（现行 **`feature/fe-tools-sidecar`**）上：

```bash
# 测前确认对照 tip 已对齐 didi（remote 名 upstream = didi）
git fetch origin main && git fetch upstream main
# 期望：origin/main 与 upstream/main 同 tip（或仅含已说明的跟踪延迟）

git diff origin/main...HEAD -- fe/packages
```

**通过条件**：输出为空。

**白名单例外（须成文）**：若暂时无法为空，须在本文件「§5 白名单」登记路径、原因与**撤出日期**；过期未撤出视为门禁失败。当前：**无白名单条目**。

**实测（2026-09-12）**：`origin/main` ≡ `upstream/main`（`c579adaa`）；`git diff origin/main...HEAD -- fe/packages` 为空。

## 2. 谁跟谁

| 面 | 路径 | 角色 |
| --- | --- | --- |
| 上游公开面 | `fe/packages/*`（尤其 `compiler` / `container-sdk`） | 与 didi 同构；**禁止**长期私有 improve |
| 私有孵化面 | `fe/tools/bundler`、`fe/tools/web-container-sdk` | 旁路唯一私有实现；`VENDOR.md` 记录复制源 |
| 复制源快照 | tag `fe-tools-copy-source`（`242b8622`） | **只读**；不在此 tag / improve 源分支上叠 sidecar 大改 |

依赖方向（不变）：`tools → packages` 允许；`packages → tools` **禁止**。

## 3. 节奏（默认）

| 触发 | 做什么 | 验收 |
| --- | --- | --- |
| **定期**（建议每跟一次上游 release / 至少双周） | `origin/main` 先追 `upstream/main`，再把工作分支 `merge origin/main` | merge 后 §1 仍通过；冲突应极少且不得把私有逻辑留在 `packages` |
| **packages 有上游语义变更**（API / 契约 / 行为） | 先落在干净 `packages`（随 merge），再**按需** port 到对应 tools 树 | tools 侧有意移植；更新相关测例；必要时在包内 `VENDOR.md` 记一笔「最近 port」 |
| **仅 tools 私有演进** | 只改 `fe/tools/**` + 伞文档 | §1 仍通过；不改 `fe/packages` |
| **意外改脏 packages** | 立即回退或抽到 tools；不得带进 long-lived 提交 | §1 恢复为空 |

**不默认做**：把 tools 私有改动反向合回 `packages` 或 didi。

## 4. tools 追源（选择性 port）

1. 在干净 `packages` 上确认上游变更（`git log` / diff 目标文件）。  
2. 在对应 tools 包内手工或补丁移植**需要的**语义（命名仍为 `@dimina/bundler` / `@dimina/web-container-sdk`）。  
3. 跑该包既有测试（至少 `fe/tools/bundler` 的 vitest / 相关冒烟）。  
4. **不要**整树覆盖 tools：tools 已分叉（session、layout、unvite 等）；整树覆盖会抹掉私有演进。  
5. 复制源 tag **不更新**，除非另立「重新 bootstrap」决策（新 Action）；日常 sync ≠ 重打 `fe-tools-copy-source`。

## 5. 白名单

| 路径 | 原因 | 撤出日期 | 登记日 |
| --- | --- | --- | --- |
| — | （空） | — | — |

## 6. 检查清单（合并 / 发 PR 前）

- [ ] `git diff origin/main...HEAD -- fe/packages` 为空（或白名单未过期）  
- [ ] 无 `packages → tools` 依赖  
- [ ] 本次若 port 了上游语义：tools 测例 / 冒烟已跑  
- [ ] 未要求、也未包含向 didi 推送本伞交付物  

## 7. 与 VENDOR.md

各 tools 包 `VENDOR.md` 保留复制元数据；**操作步骤以本文件为准**。VENDOR 内 Sync 行指向本文件。
