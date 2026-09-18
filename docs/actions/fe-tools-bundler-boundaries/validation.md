# Validation — fe-tools-bundler-boundaries

Status: **草案（随 Action `draft`）** — 实施后回填 Actual。

权威参考：[Experience-Review.md](../../Experience-Review.md)

本门是文档门。行为 0 = 产品源码零 diff，不要求重跑编译产物对拍。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-BD00 | 职责一致 | 对照 architecture-notes 术语节与 D-BD-1..6；view/style 行不是 Packer；`logic/**` 与 `dependency-graph.ts` 为焊点；无「Packer 客户」格 | A-BD0 | pending |
| P-BD01 | 落点可核对 | 表行等于 R-BD1 封口全集且路径存在；粒度仅为目录或文件；`env.ts` / `emit.ts` / `logic/**` / `dependency-graph.ts` 为焊点且写明两侧用途；`shared/**` 与 `core/**`（除 `env.ts`）为 Scheme；无待定行、无方法行 | A-BD1 | pending |
| P-BD02 | 零产品 diff | `git diff <baseline> -- fe/tools/bundler/src fe/packages` 为空。baseline = 授权进入 `in_progress` 时的 HEAD（写入 Actual）。≠ §3 扫描基线 `31db0c18` | A-BD2 | pending |
| P-BD03 | 回流 | architecture-notes 含本 Action 边界表指针。允许的术语改动只限 Packer/Scheme 节；session / CompileTarget / worker-runtime 不变量语义不变 | A-BD3 | pending |

## Uncovered

- Packer API 形状；`emit.ts` / `logic/**` / `dependency-graph.ts` 的方法级或文件级拆分：另立。
- 动态 `import()` 不在本门扫描范围内。

## Actual

（实施后填写；绑定 commit SHA）
