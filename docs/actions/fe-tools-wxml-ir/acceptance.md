# Acceptance — fe-tools-wxml-ir

Status: **ready**

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-WIR0 | R-WIR0 | 存在 Document parse API；测例覆盖特殊节点分类 | P-WIR01 | pending |
| A-WIR1 | R-WIR1 | parse 测例中 import/include/wxs 仍为节点；展开仅在 load；cheerio 非产物权威 | P-WIR01 / P-WIR07 | pending |
| A-WIR2 | R-WIR2 | `registerBackend` 可挂 ≥2（vue + stub）；同 id 抛错；生产默认仅 vue | P-WIR01 / P-WIR06 | pending |
| A-WIR3 | R-WIR3 | 全量 vitest 绿；base nomap+sourcemap `diff -rq` = 0 | P-WIR01 / P-WIR02 | pending |
| A-WIR4 | R-WIR4 | `compiler/wxml` 无 `platform ===` | P-WIR03 | pending |
| A-WIR5 | R-WIR5 | diff 无 E7/Listr/PS3/S14；实现为 JS | P-WIR04 | pending |
| A-WIR6 | R-WIR6 | 关键节点 `loc: { start, end }`；sourcemap 对拍；无猜行权威路径 | P-WIR02 / P-WIR05 / P-WIR06 | pending |
| A-WIR7 | R-WIR7 | parse 为投影；Value `kind` 三态且 expr 为字符串（或审查锚定） | P-WIR01 + 审查 | pending |
| A-WIR8 | R-WIR8 | 归属表与实现一致（抽样：展开 / Wxs 编译 / Vue 降级） | P-WIR07 | pending |
| A-WIR9 | R-WIR9 | 错误路径可见 `[wxml]` + sourceFile/loc（抽样或测例） | P-WIR07 | pending |
