# Implementation Plan — platform-abstraction

| ID | 任务 | 依赖 | 验证点 |
| --- | --- | --- | --- |
| P-001 | `src/common/platforms.js`：PLATFORMS/MODE_DEFAULTS 枚举、resolveCompileProfile（platform × mode × minify 覆盖）、InvalidPlatformError；runBuild 前置校验 | — | platform spec + 前置失败 |
| P-002 | CLI：build `--platform` + `--minify`/`--no-minify`；dev `--minify`；watch 继承 | P-001 | CLI integration spec |
| P-003 | 硬编码替换：logic-compiler/view-compiler 从 profile 读取 esTarget/minify（替换三处硬编码 + sourcemap 隐式跳过逻辑显式化） | P-001 | compiler stage specs + 产物一致 |
| P-004 | renderer × platform 约束校验（预留） | P-001 | constraint spec |
| P-005 | 缺省产物矩阵：改前 vs 改后（无参数），nomap/sourcemap，全示例 diff=0 | P-003 | 同路径 controlled diff=0 |
| P-006 | dev 产物验证：不 minify（可读多行）；`--minify` 后与 build 等价 | P-003 | dev smoke + minify 对比 |
| P-007 | 相邻回归 + 消融 + 范围护栏 | P-005/P-006 | 全量 + ablation + source diff |

执行约束：

- 每步保持全量 spec 绿；
- 缺省 build 产物逐字节一致是 MUST——任何阶段缺省 diff≠0 立即停止修复；
- `--platform web` 首版 esTarget=es2023（与 native 一致），仅语义标注；
- dev 首版不 minify——注意 A2/A3 dev server 对产物透明（静态服务），不受影响；
- 消融补丁与临时产物不入库。

## 执行记录

| 任务 | 状态 | 日期 | 备注 |
| --- | --- | --- | --- |
| P-001…P-007 | 未开始 | — | — |
