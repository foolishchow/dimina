# Validation — fe-tools-worker-architecture

Status: `draft`（决策 Action；验证 = 决策文档完备性 + 引用一致性，不跑编译）

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-WA01 | 决策完备 | 核对 technical-design §3 决策表：D-WA-1..6 每条有结论或 defer+条件 | pending |
| P-WA02 | 引用一致 | grep build-model / module-cache README 引用本 Action 路径；阶段映射无冲突 | pending |
| P-WA03 | 无源码改动 | `git diff` 不含 fe/tools/bundler 源码（仅 docs/） | pending |
| P-WA04 | 协议可评审 | 协议草案（§4）字段表与 build-model protocol.draft.md 的 output 流式设计对齐 | pending |
| P-WA05 | 追溯性 | 决策表每条有讨论依据引用（哪轮/哪个 Action 约束） | pending |