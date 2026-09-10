# Acceptance — platform-abstraction

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 缺省 platform=native；显式等价；未知 platform 前置失败 `DIMINA_INVALID_PLATFORM` | platform spec + CLI error | pending |
| A-002 | R-002 | build `--platform native/web` + `--minify/--no-minify`；dev `--minify`；watch 继承 | CLI integration spec | pending |
| A-003 | R-003 | 三处硬编码替换为 profile 读取；缺省（native+build）行为不变 | source audit + stage specs | pending |
| A-004 | R-004 | minify 由 profile 驱动；sourcemap 隐式跳过逻辑显式化 | source audit + minify specs | pending |
| A-005 | R-005 | 跨 platform × mode 不变层结构一致（modDefine 注册结构/目录/ID/警告） | 结构对比矩阵 | pending |
| A-006 | R-006 | 缺省 build 产物与改前逐字节一致 | 同路径 controlled diff=0 | pending |
| A-007 | R-007 | dev（缺省）产物不 minify（可读多行）；`--minify` 后与 build 等价 | dev smoke + minify 对比 | pending |
| A-008 | R-008 | lynx×web 无效组合明确错误（预留） | constraint spec | pending |
| A-009 | R-009 | compiler/render/sdk 全量、CLI/watch/dev/compile 全绿 | command logs | pending |
| A-010 | 消融 | 移除 platform 前置校验后目标 spec 失败 | ablation log | pending |
