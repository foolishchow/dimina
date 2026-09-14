# Requirements — fe-tools-compiler-target

Status: **冻结（2026-09-14）** — 与 design v1 / acceptance 对齐；D-CT-0..5 已拍板；改契约须同步三文

## R-CT0（MUST）组合校验（T0 · 本 Action 唯一行为变更门）

`resolveBundlerConfig` 层增加对偶断言（镜像 `assertDevCompileCompatible`）：

- `command:'build'` ⇒ `compile.platform:'native'`，否则抛 `TypeError`（消息风格同 D-R2/C：`D-R2/C: command:'build' requires compile.platform:'native', got ...`）；
- **dev 侧 D-R2/C 行为与消息不变**（现有 `/D-R2\/C/` 测试不改断言全绿）；
- build 命令 CLI `--platform` 帮助文本同步（T0 验收锁定的一部分）；
- **直调 `build({platform:'web'})` 编程路径自由度不变**（compile-config 层保留 web 解析；`sourcemapStrategyFor` web 分支保留）。
- **compile-config.spec 直测不受 T0 影响**：其 build+web 用例全部直测 `resolveCompileConfig`（不经 `resolveBundlerConfig`）；T0 仅在 resolve 层拦截（F4 明示）。

## R-CT1（MUST）CompileTarget 静态描述（T1）

存在 `fe/tools/bundler/src/compiler/compile-target.js`（design D-CT-2），导出 `createCompileTarget`：

- 内部经 `resolveCompileConfig` 取 C1（**E1 管线侧自洽保留**，R-CT4）；renderer 解析 + 校验（`resolveProjectRenderers` → `getRenderer` → `assertRendererSupportsPlatform`）；stages 白名单校验——三件事从 `_runBuild` 顶部移入，**错误消息逐字不变**（`Invalid compiler stages: ...` / `Renderer adapter not registered: ...` 等）；
- 产出静态描述（含已验证 renderer、requestedStages、C1 各轴、sourcemapStrategy）；
- `_runBuild` 顶部改道经 `createCompileTarget`；view/logic/style 组装的**静态部分**（compileConfig / sourcemap / renderer 穿参）从描述派生。

## R-CT2（MUST）动态补全 + 派生（T2）

- `readLoadBindings()`：**阶段组装侧唯一 env 读取点**（`isMiniGame()` / `getAppId()` / `getPages()`），调用时机钉死在 collect-config 之后（ALS 就绪）；阶段组装决策所需的全部动态值在此一次性捕获；
- **范围**：view/logic/style 编译器、config-compiler、publish 等模块**阶段执行内部**的 env 读取属各模块既有契约，**不迁移、不在本门范围**（R-CT6）；
- `deriveStagePlan(target, bindings, { cwd })`：**纯函数**（`cwd` 显式入参；行为 0 下与今日 `process.cwd()` 等价），产出最终阶段序列（含 mini-game 过滤）、logic `sourcemapTargetPath`、style `stylePages` 合成（synthetic app）、per-stage workerOptions 完整包；
- 补全与派生**返回新对象，无突变**；
- `build-pipeline.js` 的编译任务组装（`'编译项目'` 闭包内）改从 `deriveStagePlan` 产物构建。

## R-CT3（MUST）行为 0（T1/T2）

- tools/bundler 全量 vitest 绿（既有断言不改）；
- `examples/miniprogram/base` nomap + sourcemap 产物**字节等价**（diff=0 MUST）；
- lifecycle 事件序列不变（`.build` / `watch.start` 首编 / `.dev` 首编序列仍相等——session-unify P-SU03 断言继续全绿）；
- 公开 API / exports 面零变化；`compile-target.js` 不进 exports。

## R-CT4（MUST）E1 成文不变量（无代码变更）

- 分层不变量入档：**管线必须自解析**（直调 `build()` 路径自洽）；session 层解析服务层契约（D-R2 seeds）——两合法路径，同一纯函数；
- 结构判据：管线侧不得绕过 `resolveCompileConfig` 私算 C1（grep 锚定：`build-pipeline.js` 不得内联 `MODE_PRESETS` / `sourcemapStrategyFor` / 平台合法性判断）。

## R-CT5（MUST）结构判据（反散点）

`build-pipeline.js` 阶段组装处不得再现（测试锚定 + review 核对）：

- renderer 字符串穿参后反查（`getRenderer(renderer)?.[...]`）；
- logic 阶段内联 `sourcemapTargetPath` 计算；
- mini-game 条件直接耦合 stage push（`enabledStages.has('view') && !miniGame`）；
- 三捆手工 workerOptions 内联组装。

阶段任务从 `deriveStagePlan` 产物构建——本门交付后「形态条件单源于 compile-target」为结构不变量。

## R-CT6（MUST）范围切割

- 不新增 renderer / 不加 renderer 覆盖（A4 边界不动）；不剥 Listr；不做 TS-2；
- 不改 watch-runner / `build()` 门面 / watch-plan（除接线必需）；
- 不动 session 层（**除 T0 的 resolve 对偶断言**）；
- CLI 输出文案除 T0 帮助文本外零变化。

## Non-requirements

- 真 web target（未来按再激活条件显式重开；`sourcemapStrategyFor` web 分支保留即为此预留）
- renderer 注册面扩展、页面级混合 renderer
- Listr 替换 / 阶段对象化（超出本门的部分维持现状）
- compile-config 的平台自由度收敛（R-CT0 明确保留）
