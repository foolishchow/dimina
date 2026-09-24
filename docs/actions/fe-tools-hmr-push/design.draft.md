# Design Draft — fe-tools-hmr-push

> 设计草稿。D-PUSH-1/2/3 锁后产出 technical-design。

Status: **draft（2026-10-09）**

## §1 L_HMR level 设计（D-PUSH-1）

### §1.1 现状：RELOAD_LEVELS L0-L3

`dev-reload.ts:22`：
```typescript
const RELOAD_LEVELS = Object.freeze({
  L0: 'L0',  // 非增量全量
  L1: 'L1',  // 页面 relaunch
  L2: 'L2',  // 同 L3 语义（style）
  L3: 'L3',  // 上报级别（view）
})
```
无 HMR level。dev-server broadcast `{ type: 'reload', ...pendingReload }`（全量）。

### §1.2 目标：L_HMR level

加 `L_HMR: 'L_HMR'`——per-module payload 推送，runtime per-module update。
- payload = 变更 module 集（H1 deriveLogicBuckets 增量 + H3 per-module cache 增量）
- runtime 收 L_HMR → per-module hot-swap（非 page reload）

### §1.3 D-PUSH-1 design gate

L_HMR 语义边界：
- L_HMR vs L1：L_HMR = per-module update（runtime 就绪），L1 = page reload（fallback）
- L_HMR 触发条件：单 module/少 module 变更 + runtime 就绪
- L_HMR payload 格式：moduleId → code/map（增量集）

**待 H4 formalize 锁**：payload 格式 + 触发条件边界。

---

## §2 fallback downgrade 机制（D-PUSH-2 = D-HMR-5）

### §2.1 问题

dev server 如何知 runtime 未就绪 → downgrade L_HMR→L1？

### §2.2 选项

**选项 ① runtime capability probe**：
- dev server 探测 runtime capability（feature flag / handshake）
- runtime 就绪 → L_HMR；未就绪 → L1
- **优势**：明确 downgrade
- **风险**：runtime probe 协议（运行时侧依赖）

**选项 ② 编译侧始终发 L_HMR payload，runtime 侧自降 L1**：
- 编译侧发 L_HMR，runtime 收后自降 L1（runtime-side downgrade）
- **优势**：编译侧不需知 runtime 状态
- **风险**：runtime 须实现 downgrade 逻辑

### §2.3 D-PUSH-2 推荐

**推荐选项 ②（runtime-side downgrade）**——编译侧不依赖 runtime probe（运行时侧依赖最小化）。runtime 收 L_HMR 后：就绪 → hot-swap；未就绪 → 自降 L1 reload。

---

## §3 materialize 增量化（D-PUSH-3）

### §3.1 现状：publishToDist 全量

`publish.ts` publishToDist（全量发布 BuildModel → dist）。`materialize` 全量写盘。

### §3.2 目标：增量 materialize

只写变更产物（非全量）。BuildModel 增量 materialize：
- one-shot：全量 materialize（无 state → 无增量概念）
- watch：增量 materialize（只写 dirty entries）

### §3.3 D-PUSH-3 design gate

materialize 增量化边界：
- BuildModel 须 track 变更 entries（dirty set）
- publishToDist 须增量发布（只 copy dirty entries）
- **待实证**：BuildModel 能否 track dirty？publishToDist 增量边界？

---

## §4 行为 0 边界

### §4.1 one-shot 不受影响

H4 仅 watch 路径。one-shot 不传 state → no HMR → no L_HMR → 全量 reload（L0-L3 不变）→ diff=0 平凡成立。

### §4.2 watch 路径渐进

watch 路径加 L_HMR——runtime 就绪时 per-module push，未就绪 fallback L1。watch 字节恒等（materialize 增量产物 == 全量产物子集）。

---

## §5 实证待做（升 ready 前）

1. **payload 格式**：L_HMR payload（moduleId → code/map）格式定义
2. **BuildModel dirty tracking**：能否 track 变更 entries？
3. **publishToDist 增量边界**：增量发布可行性
4. **runtime fallback 协议**：选项 ② runtime-side downgrade 可行性（运行时侧确认）
