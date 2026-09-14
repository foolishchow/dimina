# Implementation plan — fe-tools-compiler-target

Status: **in_progress（2026-09-14）** — T0+T1+T2 已交付；待 Close；T0/T1/T2 各自 PR 禁混（P5；本轮 T1+T2 同工作区未单独合入）

## T0 触达序（组合校验 · 唯一行为变更门）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/session/resolve.js` | + `assertBuildCompileCompatible`（镜像 dev 版；调用紧邻 `assertDevCompileCompatible`） |
| 2 | `src/bin/index.js` | build 命令 `--platform` 帮助文本同步（native only 表述） |
| 3 | 测例 | `bundler-session.spec`（落点已定，紧邻既有 D-R2/C 用例；F15）+ `build + platform:'web'` 拒绝用例（消息断言 `D-R2/C: command:'build' requires`）；**dev 侧既有用例不改** |
| 4 | 验证 | 全量 vitest；CLI 冒烟（`build --platform web` → 非零退出 + stderr 消息；正常 build 产物 diff=0） |
| 5 | 消融 | 拔断言 → 拒绝用例失败 → 恢复全绿 |

## T1 触达序（静态描述 · 行为 0）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/compiler/compile-target.js` | **新建**：`createCompileTarget(runOptions)`——内部 `resolveCompileConfig`（E1 自洽）+ renderer 解析/校验 + stages 白名单；**消息逐字迁移**（`Invalid compiler stages` / `Renderer adapter not registered` / `Invalid platform` / renderer 平台不支持） |
| 2 | `src/compiler/build-pipeline.js` | `_runBuild` 顶部三件事改道 `createCompileTarget`；view/logic/style 组装的静态穿参（compileConfig / sourcemap / renderer **对象**而非字符串）从描述取 |
| 3 | 测例 | `__tests__/compile-target.spec.js`：createCompileTarget 单测（白名单 / 非法 stages / renderer 校验 / **消息文本锁定**）+ 结构锚定（阶段组装处无 renderer 字符串反查） |
| 4 | 验证 | 全量 vitest；先 `pnpm build` 同步 dist（P-CT00）→ nomap + sourcemap diff=0 |
| 5 | 消融 | 拔 createCompileTarget 回落内联 → 结构锚定（②T1 子集）失败 → 恢复全绿 |

## T2 触达序（动态派生 · 行为 0）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/compiler/compile-target.js` | + `readLoadBindings()`（**阶段组装侧**唯一读取点；worker 内部读取不迁移）+ `deriveStagePlan(target, bindings, { cwd })`（纯：最终 stages ∩ mini-game 过滤 / sourcemapTargetPath / stylePages 合成 / 三 stage workerOptions 完整包） |
| 2 | `src/compiler/build-pipeline.js` | 编译任务闭包内的三捆组装 + `!miniGame` 条件 + 内联 sourcemapTargetPath + stylePages 全部改道 `deriveStagePlan` 产物 |
| 3 | 测例 | compile-target.spec + deriveStagePlan 纯函数单测（构造 bindings 组合：mini-game / 非 mini-game × stages 子集）；结构锚定扩展（无内联 sourcemapTargetPath / 无 mini-game 直耦 / 无手工三捆） |
| 4 | 验证 | 同 T1 全套 + lifecycle 序列（session-unify.spec 行为同构断言继续全绿） |
| 5 | 消融 | 拔 deriveStagePlan（恢复闭包内联）→ 结构锚定（②T2 子集）失败 → 恢复全绿 |

## 不做（本 Action）

- 新 renderer / renderer 覆盖 / Listr 剥离 / TS-2
- watch-runner / build() 门面 / watch-plan 改动（除接线必需）
- compile-config 平台自由度收敛（web 解析保留）
- session 层改动（除 T0 断言）

## 验证

升 `in_progress` 时记基线 SHA（随门递进：T0 基线 = 升 in_progress 时 HEAD；T1 基线 = T0 合入后 HEAD；T2 基线 = T1 合入后 HEAD）→ [validation.md](validation.md) P-CT00..（Result 届时回填）
