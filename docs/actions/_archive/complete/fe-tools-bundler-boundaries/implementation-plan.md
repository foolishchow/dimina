# Implementation Plan — fe-tools-bundler-boundaries

Status: **draft（2026-09-18）** — 只规划边界表。未授权改产品代码。

## 纪律

- 不改 `fe/tools/bundler/src`。
- 不恢复已废止的目录层允许矩阵。
- 不得给落点表加行，不得恢复「Packer 客户」第四格，不得把落点细化到方法。
- 焊点（含 `dependency-graph.ts`）只保留路径级标注，不写拆分方案。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 1 | 拍板 D-BD-5（焊点）与 D-BD-6（目录/文件粒度） | done（draft 阶段设计决策） |
| 2 | 核对落点表等于 R-BD1 封口全集；焊点写清两侧；无待定行 | done（draft 阶段设计决策，见 technical-design §2） |
| 3 | 对照 `env.ts` 的 15 处引用，确认没有把总线标成某一侧的内部 | done（15 处全核对；`getDependencyGraph` 5 方读取（logic 焊点 + 4 Scheme），确认总线两侧承载） |
| 4 | architecture-notes 增加本边界表指针 | done（Packer/Scheme 术语节增加落点权威指针段） |
| 5 | `git diff <baseline> -- fe/tools/bundler/src fe/packages` 为空。**baseline** = 授权进入 `in_progress` 时的 HEAD commit（≠ §3 扫描基线 `31db0c18`） | done（baseline `1215bc0a`；src + fe/packages 零 diff） |

## 不做

抽出 Packer、拆 `emit.ts` / `env` / `dependency-graph`、方法级落点。下一 Action 必须引用本落点表，不得另发明一套 Packer/Scheme 定义。
