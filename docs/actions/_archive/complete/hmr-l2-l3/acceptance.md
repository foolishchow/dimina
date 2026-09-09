# Acceptance — hmr-l2-l3

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | HMR 代码只在 Web 容器运行时 flag 开启后可达（bridge 注入 + `hmr` 指令驱动；生产 dist 无构建期条件依赖）；无注入/无指令、生产构建、原生容器路径无行为变化 | hmr.spec + P-007 production/native audit | passed |
| A-002 | R-002 | style reload 后目标 CSS 更新：页面级（scope:page）与 app 全局（app.wxss→app.css，scope:app）均生效；service/page instance 不重启；CSS 加载失败保留旧 CSS | hmr-style.spec 8/8 + render suite | passed |
| A-003 | R-003 | view reload 后目标 module 被替换并可渲染新模板；旧 module 不污染新结果；stale buildId 被拒 | hmr-module.spec + hmr-l3-integration.spec | passed |
| A-004 | R-004 | 仅目标页面 remount；service 与其他页面实例保持；不调用整 app firstRender（除 fallback） | hmr-remount.spec + runtime integration | passed |
| A-005 | R-005 | remount 后恢复最近 setData 快照；service 不重发数据；交易期间更新按序回放 | hmr-remount/message-hmr specs + P-006 timing fix | passed |
| A-006 | R-006 | 首次/返回/快速连续保存/展开收起循环无重复监听器、孤儿 DOM、重复注册、未处理 rejection | lifecycle cleanup specs + render full suite | passed |
| A-007 | R-007 | module/replay/style 失败保留旧运行实例并可观察；L3 fallback 到 A2 L1 | hmr-l3-integration fallback + P-006a hmr:result + Web smoke | passed |
| A-008 | R-008 | A2 ws 消息形状、reloadLevel、buildId 与 dev server 契约零改动；L0/L1 行为不回归 | compiler full suite + P-007 WS smoke + source diff | passed |
| A-009 | R-009 | 静态路由/快照语义、reloadLevel 合成、ws 消息形状与 ack 时序均有 vitest 覆盖；render/sdk 全量绿 | compiler/render/sdk suites | passed |
| A-010 | R-010 | L2/L3 每个 MUST 场景均有可执行 Web 容器契约测试，而非只做代码审查 | render/sdk integration specs + P-007 real HTTP/WS smoke | passed |
| A-011 | R-011 | 快速连续变更中旧 buildId 不覆盖新结果，合并/取消路径无泄漏 | hmr.spec stale matrix + dev-reload spec | passed |
| A-012 | R-012 | 不支持 L2/L3 能力时稳定报告并回退 L1，不影响 Web dev 其他功能 | hmr fallback specs + P-007 failure smoke | passed |
| A-013 | R-013 | P-006a 内部 envelope 可端到端观察：宿主页发送 `enableDevHmr`/`hmr`，render/container-sdk 回传 `hmr:result` 三态；fallback 或发送失败触发 A2 L1；A2 `/ws` 形状不变 | dev-host 10/10 + Bridge 5/5 + P-007 protocol smoke | passed |

## Closure evidence rule

已满足：L3 module replace/remount/snapshot/replay 的时序、清理与失败 fallback 均有测试证据；真实浏览器 DOM/视觉测试工具未安装，已作为残余风险记录，不以代码存在替代 MUST 验收。
