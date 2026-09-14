# Acceptance — fe-tools-compiler-target

Status: **in_progress（2026-09-14）** — A-CT0..06；T0 实施中（基线 `4f7b712a`）；证据回填

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-CT0 | R-CT0 | build+web 在 resolve 层拒绝（消息 `D-R2/C: command:'build' requires compile.platform:'native'`）；dev 侧 D-R2/C 行为与消息**不变**（既有 `/D-R2\/C/` 断言不改）；CLI help 同步；直调 `build({platform:'web'})` 编程路径自由度不变 | P-CT04 / P-CT06 + 源码审查 | **pass（T0）** — resolve.js `assertBuildCompileCompatible` 对偶断言；CLI `--platform web` exit=1 + stderr 消息锁定，显式 native exit=0；dev 侧既有用例不改全绿；直调 `build({platform:'web'})` 编译成功（新增测例锁定）；help 文本同步（选项声明保留，platforms.spec 正则兼容） |
| A-CT1 | R-CT1 | 存在 `src/compiler/compile-target.js` 且 `createCompileTarget` 可用；`_runBuild` 顶部三件事（C1 / renderer 解析+校验 / stages 白名单）改道描述；**错误消息逐字不变**；静态穿参从描述取（renderer 对象非字符串） | P-CT05 ②T1 子集 + ③ / P-CT02 + 源码审查 | pending |
| A-CT2 | R-CT2 | `readLoadBindings` 为**阶段组装侧**唯一 env 读取点（时机在 collect-config 后；worker/编译器内部读取属既有契约，不迁移）；`deriveStagePlan` 纯函数返回新对象；最终 stages（mini-game 过滤）/ sourcemapTargetPath / stylePages / 三 stage workerOptions 全部派生；**E6 两段性由显式 API + collect-config 后时序锁定** | P-CT05 ②T2 子集 / P-CT03 + 源码审查 | pending |
| A-CT3 | R-CT3 | vitest 全绿（既有断言不改）；nomap + sourcemap diff=0；lifecycle 事件序列不变（session-unify 同构断言全绿）；exports 面零变化（compile-target 不进公开面） | P-CT01 / P-CT02 / P-CT03 / P-CT06 | pending |
| A-CT4 | R-CT4 | E1 成文不变量入档；结构判据：`build-pipeline.js` 无内联 `MODE_PRESETS` / `sourcemapStrategyFor` / 平台私算 | P-CT05 ③ + 文档审查 | pending |
| A-CT5 | R-CT5 | 阶段组装处无 renderer 反查 / 内联 sourcemapTargetPath / mini-game 直耦 / 手工三捆（测试锚定 + review 核对） | P-CT05 ①② | pending |
| A-CT6 | R-CT6 | diff 范围限 compile-target + build-pipeline + resolve + bin help + 测试；无 renderer 扩展 / Listr / TS-2 / watch 内部混入 | P-CT07 | pending |

## Non-acceptance（本门不验）

| 项 | 说明 |
| --- | --- |
| 真 web target 能力 | 显式重开条件（未来）；本门仅保留 `sourcemapStrategyFor` web 分支 |
| renderer 注册面 / 页面级混合 renderer | A4 边界外 |
| Listr 替换 / 阶段对象化 | 超出本门，维持现状 |
| E7 watch-plan 形态耦合 | 本门仅记录（README Non-goal）；`plan.options` 契约保持；另立 Action 再议 |
| CLI 输出文案（除 T0 help） | 行为 0 范围内不验文案 |

## Notes

- **消融 ×3（MUST）**：T0 拔断言 → 拒绝用例失败；T1 拔 createCompileTarget → 结构锚定失败；T2 拔 deriveStagePlan → 结构锚定失败。纪律按 Experience-Review §6。
- **基线随门递进**（P-CT02）：T0 = 升 in_progress 时 HEAD；T1 = T0 合入后；T2 = T1 合入后。
- **P-CT00 dist 前置**沿用 session-unify（exports 面在 dist，测试直连 src）。
- 升 `in_progress` 需明确授权。
