# Technical Design — fe-tools-incremental-chain-residuals-closeout

Status: **draft（2026-10-09）**

## §1 现状（G5 complete 后）

### §1.1 R1 缺口（核心）

3 个 `PackerSessionState` 创建点（[广回顾 §3.1](../../fe-tools/2026-10-09-g1-g5-broad-retrospect.md)）：

| 路径 | 行 | viewCache/styleCache | 性质 |
| --- | --- | --- | --- |
| `watch-runner.ts` | `:90` | `undefined`（不赋值） | ❌ watch 缺口（R1） |
| `index.ts`(build) | `:38` `options.state ?? new PackerSessionState()` | `undefined` | ✅ one-shot 设计 |
| `build-pipeline.ts` | `:23` `runOptions.state ?? new PackerSessionState()` | `undefined` | ✅ one-shot 设计 |

G5 算法链路：orchestrator `:174/187` 透传 `state.viewCache/styleCache`（常 undefined）→ stage-channel `:49` IIFE `c ? new Map(c) : null`（c=undefined→null）→ compileML `viewCache?.get()` = undefined → 永远 miss。

### §1.2 invalidatedModules 链路（已接通）

`watch-plan.ts:162` 产 → `index.ts:73` → `orchestrator.ts:189` → `stage-channel.ts:51` → worker。链路通，终点空转（R1 修复后终点有 cache 才生效）。

## §2 target 形状

### §2.1 R1 — watch-runner 实例化（D-IRC-1）

```typescript
// watch-runner.ts:90 后
const sessionState = state ?? new PackerSessionState()
// G5 D-IRC-1: watch 路径启用 cross-rebuild view/style cache（one-shot 创建点保持 undefined→no-op→diff=0）
if (!sessionState.viewCache) sessionState.viewCache = new Map()
if (!sessionState.styleCache) sessionState.styleCache = new Map()
```

**`if (!...)` 守卫**：外部传入 `state`（已有 cache 实例）时不覆盖。`state ?? new ...` 分支的新建态必然 undefined → 赋值。

**不改 one-shot 创建点**（`index.ts:38` / `build-pipeline.ts:23`）——保持 undefined → orchestrator 透传 undefined → stage-channel no-op → 全量编译 → diff=0（G5 行为 0 边界延续）。

### §2.2 R7 — viewCompileResults 保留 + 标注（D-IRC-2）

```typescript
// view/index.ts viewCompile 返回（不改 shape）
async function viewCompile(...): Promise<{ viewCompileResults: ViewCompiledModule[]; viewPageBundles: Array<{...}> }> {
  // ...
  return { viewCompileResults, viewPageBundles }
}
```

加注释（`view/index.ts` viewCompile 返回 shape 处）：

```typescript
// G5 D-G5-4'：viewPageBundles 供 stage-channel 写 per-page-bundle viewCache（活跃）。
// viewCompileResults（flattened dirty ViewCompiledModule[]）：G4 期供 stage-channel 写 per-module cache；
// G5 改读 viewPageBundles 后 stage-channel 不再消费，但有意保留——HMR 未来作 dirty signal。
// runtime.ts:33 Object.assign(response, compileResult) 仍 postMessage（vestigial-but-intentional）。
```

### §2.3 R9 — ensureWxsScan 条件化（D-IRC-3，SHOULD）

```typescript
// view/index.ts compileML——ensureWxsScan 移入条件分支
async function compileML(pages, root, progress, viewCache?, invalidated?) {
  // G5 D-IRC-3/R9：仅当至少一 page cache-miss 时才扫 wxs（全 cache-hit 跳过——hit 不消费 wxs）
  // 预检须保守（pessimistic）——与 loop cache-hit 逻辑严格一致，避免 hasMiss=false 但 loop miss → viewParseWalk 缺 wxs
  const hasMiss = pages.some(p => {
    const b = viewCache?.get(p.path)
    return !b || b.some(m => invalidated?.includes(m.moduleId) ?? false)  // 与 loop 判定同式
  })
  if (hasMiss) ensureWxsScan(getWorkPath())
  // ...
}
```

**保守性约束**：`hasMiss` 预检式须与 loop 内 cache-hit 判定**逐字同式**（bundle 存在 + bundle 内任一 module invalidated → miss），否则 hasMiss=false 但 loop miss → viewParseWalk 缺 wxs scan → 回归。**若 `hasMiss` 引入复杂度/回归风险** → 降级 Non-acceptance（R9 info，不实施，保持无条件 scan）。

### §2.4 R6 — 集成测 `.css` 断言

`view-style-cache-skip.spec.js` 集成测 ① 加：

```javascript
const css1 = fs.readFileSync(findFile(out1, 'pages_home_index.css'), 'utf8')
const css2 = fs.readFileSync(findFile(out2, 'pages_home_index.css'), 'utf8')
expect(css1).toBe(css2)  // style cache-hit 字节恒等
```

### §2.5 R8 — env reset

```javascript
afterEach(() => {
  delete process.env.DIMINA_COMPILER_DIFF_VERIFY  // R8: 防泄漏
  if (srcDir && fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true })
})
```

### §2.6 R4 — docs 导航修

核查 `docs/fe-tools/README.md` packer-context 等状态标注 → 与 STATUS.md（complete）对齐。

## §3 决策

### D-IRC-1: watch-runner 实例化点（R1）

在 `watch-runner.ts:90` `new PackerSessionState()` 后赋 `new Map()`（`if (!...)` 守卫外部 state）。**不进 PackerSessionState 构造**——保持 one-shot 默认 undefined 边界（D-G5-1/F10 延续）。

### D-IRC-2: viewCompileResults 保留（R7）

保留 shape + 注释标 HMR-future dirty signal。**不从 shape 删**——runtime.ts:33 Object.assign postMessage 该字段，删可能破未知的 response 消费者；HMR 未来需 dirty 信号。vestigial-but-intentional。

### D-IRC-3: ensureWxsScan 条件化（R9，SHOULD）

`hasMiss` 预检 → 全 cache-hit 跳过 scan。微优化（一次/worker 的 dir 读）。若非平凡则降级。

### D-IRC-4: 行为 0 边界

R1 接线后：one-shot（`index.ts:38`/`build-pipeline.ts:23` 不改）→ undefined → no-op → 全量 → diff=0（不变）。watch 启用 cache → 效能提升，产物字节恒等（cached code/map = 全量结果；既有集成测覆盖）。

### D-IRC-5: 接线回归测（R1 接线锁，注入 state + mock build）

注入 `state: new PackerSessionState()`（viewCache 未设）+ mock build（避免真实 build 重量）→ watch-runner R1 接线（`:90` `if(!sessionState.viewCache) sessionState.viewCache = new Map()`）赋值 → 断言 `state.viewCache` 是 `Map` instance（非 undefined）+ `styleCache` 同。**不手建 Map**（Map 由 watch-runner R1 接线赋值，非测试手设）。锁接线，防回退。

## §4 风险

| 风险 | 缓解 |
| --- | --- |
| R1 接线后 watch 产物字节变化 | cached code/map = 全量结果（emitEntry 确定性）→ 字节恒等；既有集成测覆盖 |
| R9 hasMiss 预检误判（sub invalidated 未检） | hasMiss 检 bundle invalidation（含 transitive subs）；或降级 Non-acceptance |
| viewCompileResults 保留误用 | 注释明示 vestigial-but-intentional；HMR 前不消费 |
| 接线遗漏（仅改 watch-runner，one-shot 误改） | impl-plan 明示 3 创建点，仅 watch-runner 改 |
