# Acceptance — fe-tools-packer-context

Status: **draft（2026-09-22）** — D-PC-0..11 已冻；A-PC1..5 pending。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-PC1 | R-PC-1 | 可构造可用 `PackerContext`（paths/fileTypes/readContent 非空转；resolvers stub；无新增 exists 字段） | P-PC01 | pending |
| A-PC2 | R-PC-2 | Graph 路 2：消费 ctx；内容经 readContent；exists 仅 Graph 侧 fs；npm=`NpmResolver(workPath)`；无 void-ctx/ALS store* 主路径；build 无 ALS getter 回环；kind 用 ctx.fileTypes | P-PC02 | pending |
| A-PC3 | R-PC-3 | 公开入口仍经 orch；ctx 由 storeInfo 装配；无 pipeline 双脑回退 | P-PC03 | pending |
| A-PC4 | R-PC-4 | 行为 0：全量 7 项目 diff=0（air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui）+ vitest + tsc | P-PC04 | pending |
| A-PC5 | R-PC-5 | getter/storeInfo 契约可用；Scheme 不进 PackerContext；store* 薄壳非双轨主路径 | P-PC05 | pending |

## Non-acceptance

- 仅改注释/adapter 仍 `void ctx` 宣称路 2
- 本门实施 IU / load-compile 拆 / 真 registry / resolvers 真接
- 本门扩展 PackerContext `fileExists`（违背 D-PC-7）
- orch 直组 PackerContext
- build 中经 ALS getter 回环未完成 Graph
- 未授 `in_progress` 即改 `src`
