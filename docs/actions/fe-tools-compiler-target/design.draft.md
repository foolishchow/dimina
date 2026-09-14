# Design draft — fe-tools-compiler-target

Status: **冻结 v1（2026-09-14）** — D-CT-0..5 已拍板；实施中改设计须修订本档并同步 requirements / acceptance

## 职责表

| 关注点 | 归属 | 说明 |
| --- | --- | --- |
| C1 语义 | `shared/compile-config.js`（CF-1 不动） | `createCompileTarget` 内部经它取值（E1 管线侧自洽，R-CT4） |
| renderer 解析 + 平台校验 | **createCompileTarget**（T1） | 从 `_runBuild` 顶部移入；fail-fast 时机不变（Listr 启动前）；消息逐字不变 |
| stages 白名单校验 | **createCompileTarget**（T1） | `Invalid compiler stages: ...` 消息不变 |
| mini-game / appId / pages 读取（阶段组装侧） | **readLoadBindings**（T2） | 阶段组装侧**唯一**访问点；时机钉死 collect-config 后（ALS）；worker/编译器内部读取不迁移（F1） |
| 最终阶段 / workerOptions / sourcemapTargetPath / stylePages | **deriveStagePlan**（T2） | 纯函数（target, bindings）→ 新对象 |
| 组合校验（build⇒native） | `resolveBundlerConfig`（T0） | 对偶 `assertDevCompileCompatible`；入口纪律 |
| Listr 渲染 / 阶段执行 | build-pipeline（不动） | 阶段任务从 plan 构建 |
| watch-plan / rebuild 形态回灌 | 不动（E7 记录在案） | plan.options 继续喂 build()，由管线统一消化 |

## API 形状（三步显式 · D-CT-3）

```js
// src/compiler/compile-target.js（内部模块，不进 exports）

createCompileTarget(runOptions)      // 静态段：内部 resolveCompileConfig + renderer 解析/校验
  → { mode, platform, esTarget, minify, sourcemap, sourcemapStrategy,
      renderer: { name, adapter },   // 已验证（getRenderer 结果，非字符串）
      requestedStages: Set<'view'|'logic'|'style'>,
      targetPath, useAppIdDir, workPath }

readLoadBindings()                   // 动态段：{ miniGame, appId, pages }——阶段组装侧唯一读取点

deriveStagePlan(target, bindings, { cwd })   // 纯函数（cwd 显式，行为 0 等价）→ 新对象：
  → { stages: ['view'|'logic'|'style'],  // requestedStages ∩ 非 mini-game 灭除
      stageSpecs: { view?: {workerOptions, renderer}, logic?: {...}, style?: {...} },
      sourcemapTargetPath, stylePages }
```

## 两段性时序（E6 处置）

```text
_runBuild 顶部     const target = createCompileTarget(runOptions)   // fail-fast（消息不变位）
Listr ─ 初始化项目  collect-config（store.load；ALS 建档）
                   const bindings = readLoadBindings()              // ALS 就绪，唯一读取点
                   const plan = deriveStagePlan(target, bindings)   // 纯
        ─ 编译项目  compile tasks 从 plan.stageSpecs 构建
        BUILD_END 载荷的 appId 复用 bindings（避免二次 env 读取；行为等价）
```

- 补全/派生**返回新对象**，无突变；`deriveStagePlan` 只接受完整 bindings（形状校验挡时序误用）；
- **结构锚定范围 = `'编译项目'` 任务闭包内（阶段组装处）**；`BUILD_END` 载荷的 `getAppId()` 改经 bindings 捕获（F2 定界）；锚定后该闭包零 env 读取；
- 三函数各自可单测（create 用 runOptions；derive 用构造的 (target, bindings) 组合）。

## 门切分（D-CT-1：T0 前置 + T1 静态 / T2 动态，各自 PR 禁混）

| 门 | 性质 | 交付物 | 禁混 |
| --- | --- | --- | --- |
| **T0** 组合校验 | **行为变更**（唯一） | resolve 对偶断言 + CLI help 同步 + 测试锁定 | 不碰管线 |
| **T1** 静态描述 | 行为 0 | compile-target.js（create）+ `_runBuild` 顶部改道 + 静态穿参派生 | 不动动态段 |
| **T2** 动态派生 | 行为 0 | readLoadBindings + deriveStagePlan + 编译组装改道 | 不改 T1 静态路径 |

## 结构判据（反散点 · R-CT5）

模式名（描述/派生/两段性）仅作评审词汇；验收以病症反向要求表达——阶段组装处不得再现 renderer 反查 / 内联 sourcemapTargetPath / mini-game 直耦 / 手工三捆 workerOptions。**锚定范围与 BUILD_END 载荷处置见 §两段性时序（F2）**。**分两步收敛**：T1 清 renderer 反查 + C1 私算（E2/E1）；T2 清 mini-game 直耦 / 内联 sourcemapTargetPath / 手工三捆（E3/E4/E5）——per-gate 锚定子集见 validation P-CT05。**交付后「形态条件单源于 compile-target」为结构不变量**（新增形态轴必须经描述 + 派生，不得在闭包内散算）。

## T0 细则（D-CT-0）

```js
function assertBuildCompileCompatible(command, compile) {
	if (command !== 'build') return
	if (compile.platform !== 'native') {
		throw new TypeError(
			`D-R2/C: command:'build' requires compile.platform:'native', got ${JSON.stringify(compile.platform)}`,
		)
	}
}
```

- 消息复用 D-R2/C 决策号（策略 C 双侧对称化）；调用点紧邻 `assertDevCompileCompatible`；
- **入口纪律 ≠ 描述模型坍缩**：CompileTarget 仍全轴；`sourcemapStrategyFor` web 分支保留（真 web target 未来显式重开）；
- CLI help：build 命令 `--platform` 说明更新（T0 验收锁定）；dev 命令无 `--platform`（现状）。

## 决策记录（已拍板 · 2026-09-14，全部照建议）

| ID | 决策 | 备注 |
| --- | --- | --- |
| D-CT-0 | T0 独立小门：resolve 对偶断言 + 结构化报错 + CLI help 同步；不坍缩描述模型 | E8 处置；对齐 A4"不静默"哲学 |
| D-CT-1 | 三门 T0/T1/T2 各自 PR | 对齐 S1/S2 + P5；接受切面同链前后段的代价 |
| D-CT-2 | 落点 `src/compiler/compile-target.js`；对象名 `CompileTarget` | 纪律：禁缩写 `target`（防与 targetPath 混淆） |
| D-CT-3 | 三步显式 API：create / readLoadBindings / deriveStagePlan | 纯函数、返回新对象、无突变 |
| D-CT-4 | E1 不改代码：成文不变量 + 结构判据 | audit 定性修正（by design） |
| D-CT-5 | Action 名 `fe-tools-compiler-target` 转正 | — |

## 已确认设计输入（引用，不重定）

A4 renderer 抽象边界 / CF-1（C1 唯一语义源）/ CF-2（platform + sourcemapStrategy）/ M-A / RR4 / L3（直调自洽——E1 保留的根因）/ D-R2（策略 C 双侧化）/ 结构判据纪律（session-unify 已立）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | v1 成稿：职责表、三步 API、两段性时序、三门切分、T0 细则、D-CT-0..5 拍板 |
| 2026-09-14 | Review F1–F4 修正：readLoadBindings 收窄为**阶段组装侧**唯一读取点（worker 内部读取显式划出范围）；结构锚定范围定界（`'编译项目'` 闭包内 + BUILD_END appid 经 bindings）；`deriveStagePlan` cwd 显式入参；**冻结 v1** |
| 2026-09-14 | Review R2 F8：结构判据段补 per-gate 收敛注记（T1 清 E2/E1；T2 清 E3/E4/E5）——与 validation P-CT05 双层锚定对齐 |
