# Requirements — hmr-l2-l3

## R-001（MUST）Web 容器边界严格隔离

所有 HMR 生效逻辑仅运行于 `fe/packages/render` + `fe/packages/container-sdk`（及宿主页 `dev-host.js` 的 ws 分发 js）的 Web 容器 dev-only 路径，并由**运行时 feature flag** 控制（生产 dist 中构建期条件不可用，见 technical-design §1）。原生四端、bridge 契约、生产路径和 DMCC 产物不变。

## R-002（MUST）L2 CSS hot swap

仅 style 阶段成功构建后，Web 容器更新目标样式：页面级 CSS（`scope:'page'`）与 app 全局样式（`app.wxss` → `app.css`，`scope:'app'`，影响所有页面）均需支持；不重启 service、不重建页面实例、不触发 L1 relaunch。样式编译/加载失败时保留旧 CSS 和运行实例。

## R-003（MUST）L3 view module replacement

仅 view 阶段成功构建后，Web render 能够使目标页面加载新 view module，而不是被既有 `staticModules[path]` 缓存永久遮蔽；替换操作必须限定在 dev-only。

## R-004（MUST）L3 页面级 remount

L3 只 remount 受影响页面，保留 service 实例和未受影响页面；不得退化为默认整 app `firstRender`，除非进入明确的 L1 fallback。

## R-005（MUST）L3 setData 快照回放

页面 remount 后，render 侧回放 remount 前最近 setData 状态；service 不重发 firstRender/setData。回放时序必须在新 view 挂载完成后执行，并处理 remount 期间到达的更新。

## R-006（MUST）生命周期安全

首次进入、返回、快速连续保存、展开收起循环、组件卸载/重挂等场景不得产生重复监听器、孤儿 DOM、重复模块注册、未处理 rejection 或 service/render bridge 死锁。

## R-007（MUST）失败安全与 L1 fallback

view/style 构建失败、module replacement 失败、snapshot replay 失败或生命周期时序无法满足时：

- 保留当前可运行实例与最后成功资源；
- 不污染旧 module；
- L3 必须降级为 A2 的 L1 页面 relaunch，或 L2 保留旧 CSS；
- 向 dev 诊断输出可观察失败原因。

## R-008（MUST）A2 协议兼容

不修改 A2 已冻结的 ws 消息形状和 reloadLevel 合成。A3 只改变 Web 宿主页对 L2/L3 消息的执行能力。

## R-009（MUST）原生/生产无回归

原生四端容器、非 dev 构建和无 HMR feature flag 的 Web 容器行为保持不变；既有 render/container-sdk 规格全绿。

## R-010（MUST）可观察契约测试

测试覆盖：L2 CSS 更新、L3 module replace、页面 remount、snapshot replay、service 状态保留、失败 fallback、重复更新去重与生命周期清理；不得只以实现存在作为完成依据。

## R-011（SHOULD）合并快速连续变更

连续 view/style 保存应在 dev server 已有 buildId/调度语义下安全消费；过期 buildId 不得覆盖新模块或旧快照。

## R-012（MAY）运行时能力探测

若 Web 容器或浏览器不支持目标能力，可在运行时报告不支持并稳定回退 L1，不影响原生端。

## R-013（MUST）Web 容器内部 envelope 与回传路径冻结

A2 `/ws` reload 消息形状不得修改。Web 宿主到 render 的内部指令固定为 `enableDevHmr`（flag 注入）及 `hmr`（`{ level, changedStages, affectedPages, buildId }`）；render 回传固定为 `hmr:result`（`{ buildId, level, status: 'accepted'|'applied'|'fallback', reason? }`，`target:'container'`）。`fallback` 或发送失败必须进入 A2 L1，不得静默丢失。

## Non-scope

编译器、dev server/ws 协议、原生容器、service 状态迁移、L4、生产 HMR、性能优化均不在本 Action 范围内。
