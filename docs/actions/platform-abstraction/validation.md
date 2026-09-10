# Validation — platform-abstraction

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| platform/profile resolver | vitest spec | spec 日志 |
| CLI integration | `dmcc build --platform` / `--minify` / dev `--minify` | 命令日志 |
| 缺省产物矩阵 | 同绝对路径改前 vs 改后（无参数），nomap/sourcemap，全示例 | `diff -r` 为空 |
| dev 产物验证 | dev（缺省）不 minify 多行可读；`--minify` 后与 build 产物对比 | 产物对比日志 |
| 不变层验证 | 不同 profile 产物 modDefine 结构/目录/ID 对比 | 结构对比 |
| 相邻回归 | compiler/render/sdk 全量 + CLI/watch/dev/compile | 命令日志 |
| 消融 | 移除 platform 校验后 spec 失败 | 前后日志 |
| 范围护栏 | source diff 无 renderer/render/sdk/native 改动 | git diff |

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 闭合判定（模板）

- A-001~A-010 全部 passed；
- 缺省产物逐字节一致（diff=0）；
- dev minify 差异有验证；
- RFC D6:B + compile profile 概念回写；
- 无未记录的未覆盖区域。
