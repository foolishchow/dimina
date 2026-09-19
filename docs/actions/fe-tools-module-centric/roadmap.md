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
M1 fe-tools-module-invalidation（刀 2）← **`ready`**；T1–T7 已冻（D-IV-1..9）
        │
        ▼
M2 fe-tools-module-result-cache（刀 3）
        │
        ▼
伞 close（子门 complete 或书面降级）
```

| 门 / 子门 | 状态 |
| --- | --- |
| MF0 本伞 | **`ready`**（2026-09-19） |
| D-MF-1 | **已封口**（方案 A；logic-only；view/style 排除；规范形另门） |
| M1 invalidation | **`ready`**（2026-09-20 授权；D-IV 已冻）→ [README](../fe-tools-module-invalidation/README.md) |
| M2 result-cache | 未 formalize |
| M0 emit W1 | 可选 |
