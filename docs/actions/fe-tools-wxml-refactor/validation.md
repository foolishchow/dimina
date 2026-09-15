# Validation — fe-tools-wxml-refactor

Status: **draft（2026-09-15）** — P-WR01..07 已冻结；promotion/实施后回填 Result。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WR01 | W1 归位与模块链 | `grep` 23 个函数定义/旧路径；`node --input-type=module` 依次 import index/transform/backend/worker；抽样函数体 diff | A-WR0 | pending |
| P-WR02 | Document contract | 标准 fixture：检查 attrs=Attr[]、Value 三态、special type、directives/slot/selfClosing、null/[]；grep transform/backend 无 cheerio、`_$`、`_elem` | A-WR1/A-WR2 | pending |
| P-WR03 | W2 include/import/origin | include/import fixture：展开、sourceFile/span、序列化、template/wxs 排除与 Vue line origins | A-WR2 | pending |
| P-WR04 | parser switch + 对拍 | 默认运行；`WXML_PARSER=cheerio`；非法值；同源 fixture 比较 type/name/value/directive/special/span（cheerio attr span null 例外） | A-WR3/A-WR5 | pending |
| P-WR05 | full regression | `cd fe/tools/bundler && node scripts/sync-dist-from-src.js && npx vitest run --no-file-parallelism` | A-WR4 | pending |
| P-WR06 | output behavior-0 | 默认 napi 与 `WXML_PARSER=cheerio` 编译同一 base/fixture；`diff -rq --exclude='*.map'` + map diff 均为 0 | A-WR4 | pending |
| P-WR07 | ablation | 最小禁用 parser switch / 标准 shape 分类；目标对拍断言失败；恢复后同命令通过；按 Experience §6 记录 | A-WR5 | pending |

## Diff scope

`git diff --stat` 只能包含 `fe/tools/bundler/src/compiler/view/wxml/`、必要的 view/index import wiring、tests、Action 文档及 parser 依赖；`fe/packages` 必须零改动。

## Uncovered

预览/真机/视觉、跨平台 napi 预编译分发、性能优化不是本 Action MUST；若执行只作附加证据。