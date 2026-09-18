# Acceptance — fe-tools-bundler-boundaries

Status: **草案（随 Action `draft`）** — 实施后回填。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BD0 | R-BD0 | D-BD-1..6 在档且与术语一致；view/style 不是 Packer 插件；`logic/**` 与 `dependency-graph.ts` 是焊点；无第四格 | P-BD00 | passed |
| A-BD1 | R-BD1 | 落点表等于封口全集；每项是 Packer、Scheme 或焊点；粒度仅为目录或文件；焊点写明两侧、无方法级拆分 | P-BD01 | passed |
| A-BD2 | R-BD2 | `fe/tools/bundler/src` 与 `fe/packages` 相对授权 `in_progress` 时的 baseline HEAD 零 diff | P-BD02 | passed |
| A-BD3 | R-BD3 | architecture-notes 指向本边界表，且未改写既有不变量语义 | P-BD03 | passed |

## Non-acceptance

- 用「目录没有向上 import」代替 Packer/Scheme 落点表。
- 把落点表细化到方法，或把本门做成焊点拆分设计。
- 任何产品代码改动。
