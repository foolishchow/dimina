# Acceptance — hmr-l2-l3

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | HMR 代码只在 Web 容器运行时 flag 开启后可达（bridge 注入 + `hmr` 指令驱动；生产 dist 无构建期条件依赖）；无注入/无指令、生产构建、原生容器路径无行为变化 | flag guard spec + source diff | pending |
| A-002 | R-002 | style reload 后目标 CSS 更新：页面级（scope:page）与 app 全局（app.wxss→app.css，scope:app）均生效；service/page instance 不重启；CSS 加载失败保留旧 CSS | render/container-sdk integration spec（含两种 scope） | pending |
| A-003 | R-003 | view reload 后目标 module 被替换并可渲染新模板；旧 module 不污染新结果；stale buildId 被拒 | loader contract spec | pending |
| A-004 | R-004 | 仅目标页面 remount；service 与其他页面实例保持；不调用整 app firstRender（除 fallback） | page lifecycle spec | pending |
| A-005 | R-005 | remount 后恢复最近 setData 快照；service 不重发数据；交易期间更新按序回放 | snapshot replay spec | pending |
| A-006 | R-006 | 首次/返回/快速连续保存/展开收起循环无重复监听器、孤儿 DOM、重复注册、未处理 rejection | lifecycle regression suite | pending |
| A-007 | R-007 | module/replay/style 失败保留旧运行实例并可观察；L3 fallback 到 A2 L1 | failure/fallback spec + dev smoke | pending |
| A-008 | R-008 | A2 ws 消息形状、reloadLevel、buildId 与 dev server 契约零改动；L0/L1 行为不回归 | protocol compatibility spec + diff | pending |
| A-009 | R-009 | render/container-sdk 全量既有规格绿；原生/生产路径无改动 | full test/build + source audit | pending |
| A-010 | R-010 | L2/L3 每个 MUST 场景均有可执行 Web 容器契约测试，而非只做代码审查 | new spec logs | pending |
| A-011 | R-011 | 快速连续变更中旧 buildId 不覆盖新结果，合并/取消路径无泄漏 | stale-build integration spec | pending |
| A-012 | R-012 | 不支持 L2/L3 能力时稳定报告并回退 L1，不影响 Web dev 其他功能 | capability/fallback spec | pending |

## Closure evidence rule

若 L3 prototype 不满足 R-003/R-004/R-005 的时序或清理条件，A-003~A-005 不得标记 passed；应记录失败证据并将交付判定为 L3→L1 fallback，而不是以降级实现冒充 L3 完成。
