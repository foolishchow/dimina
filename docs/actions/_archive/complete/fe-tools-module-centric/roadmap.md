# Roadmap — fe-tools-module-centric

```text
MF0 词汇 + 顺序（本伞 ready ✓）
        │
        ▼
D-MF-1 moduleId 封口 ✓
        │
        ├─（可选）M0 emit W1 参数化
        │
        ▼
M1 fe-tools-module-invalidation（刀 2）← **`complete`**；T1–T7 已冻 + 已实施
        │
        ▼
M2 fe-tools-module-result-cache（刀 3）← **`complete`**；D-RC-1..4 冻结已实施
        │
        ▼
伞 close ← **`complete`**（2026-09-21）
```

| 门 / 子门 | 状态 |
| --- | --- |
| MF0 本伞 | **`complete`**（2026-09-21） |
| D-MF-1 | **已封口**（方案 A；logic-only；view/style 排除；规范形另门） |
| M1 invalidation | **`complete`**（2026-09-20；D-IV 已实施）→ [README](../../../_archive/complete/fe-tools-module-invalidation/README.md) |
| M2 result-cache | **`complete`**（D-RC-1..4 冻结已实施）→ [README](../../../_archive/complete/fe-tools-module-result-cache/README.md) |
| M0 emit W1 | **deferred**（S 级，另门可独立先行） |
