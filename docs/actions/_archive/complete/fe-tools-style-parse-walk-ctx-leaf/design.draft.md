# Design — fe-tools-style-parse-walk-ctx-leaf
## D-SPL-1 — styleLoad 加 ctx + fallback ALS
styleLoad 是叶子（不调其他独立函数）——无递归 caller 链。加 ctx optional + L91/96 fallback ALS。caller L136 在 buildCompileCss 内（ctx 已有）。
