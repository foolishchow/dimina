# Acceptance — fe-tools-compiler-layering

Status: **in_progress（2026-09-15）** — A-CL0..04；L0 实施中（基线 `5c4ce74f`）；证据回填

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-CL0 | R-CL0 | 目标结构存在：view/{wxml,wxs,expression,asset,index.js} + logic/ + style/ + core/{env,npm-resolver,npm-builder,sourcemap,compatibility,compatibility-reference,renderers,expression-parser} + pipeline/{build-pipeline,compile-target,compile-stages,config-compiler,stage-channel,publish}；原平铺文件消失 | P-CL01 + 目录 ls 对照 README 结构图 | ✓（见 Actual）|
| A-CL1 | R-CL1 | 61 函数穷举迁移完成：新位置函数计数合计 61；view-compiler.js 不存在；每函数体逐字不变（可抽样 diff） | P-CL02 | ✓（见 Actual）|
| A-CL2 | R-CL2 | WORKER_ENTRY 映射生效（三域 spawn 路径正确）；12 spec import 更新完成 | P-CL03 + 全量 vitest | ✓（见 Actual）|
| A-CL3 | R-CL3 | 全量 vitest 绿（559+）；nomap + sourcemap diff=0；fe/packages 零触碰 | P-CL04 / P-CL05 | ✓（见 Actual）|
| A-CL4 | R-CL4 | diff 仅目录移动 + import 更新 + stage-channel 映射；无函数体变更 | P-CL06 | ✓（见 Actual）|

## Non-acceptance（本门不验）

| 项 | 说明 |
| --- | --- |
| ctx.dom / napi parser | 下一 Action（TODO 候选） |
| worker 协议 / worker-pool | 不动即不验 |
| 测试逻辑 | 只改 import 路径 |
| dist | sync-dist 全树镜像自动跟随，不额外验 |

## Notes

- **本 Action 无消融**（纯移动无"机制"可拔——归属表穷举 + diff=0 + 全量绿即为完整证据）
- 唯一验收风险：函数级拆散的剪切错误——由 P-CL02（计数 61）+ 全量 vitest（任何遗漏即测试挂）双保险
- 升 `in_progress` 需明确授权

