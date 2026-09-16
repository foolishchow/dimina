# Technical Design — fe-tools-bundler-emit-layer

Status: **冻结 v1（2026-09-15）** — D-E-1..8；与 requirements / plan / acceptance 同步。

## 1. 现状锚定（实证）

| 引擎 | 产物 | 写盘点 | transform | 模块概念 |
| --- | --- | --- | --- | --- |
| view | pages_X.js（每页） | mkdir + write × 4 | **整包一次** + moduleRanges 行定位 | scriptRes Map（render 模块） |
| logic | logic.js（每包） | mkdir + write × 3 | **逐模块**（minify 时） | compileRes 数组 |
| style | pages_X.css + map（每页） | mkdir + write × 2 | 无（CSS 编译在 buildCompileCss 内完成） | 无（单文件产物） |

共同问题：各自 `mkdirSync` + `collectOutput ? postMessage : fs.writeFileSync` 样板 ~100+ 行；build-model materialize 声称"唯一写盘出口"但直写路径未收敛（9 处）。

## 2. 目标形状

```text
src/compiler/{view,logic}/index.js（编译）
  └─ 产出「模块集合」iterable<{moduleId, code, map}>（提供者 A0 = scriptRes/compileRes）
        └─ pipeline/emit.js  emitEntry(...)
             ├─ transform 策略注入（bundle / perModule —— 各自 apply + 错误定位）
             └─ → pipeline/output.js  write({path, content, map?, collectOutput})
                    └─ collectOutput ? postMessage(M1) : mkdir + writeFileSync
src/compiler/style/index.js
  └─ → pipeline/output.js  write({path, css/map, collectOutput})   // 不经 emitEntry
```

## 3. 模块集合契约（D-E-1/D-E-6）

```js
/**
 * 模块集合：emit 的输入规约（不绑定具体容器）。
 * 提供者：现在 scriptRes（Map）/ compileRes（Array）；未来 ModuleCache（刀 3）。
 * @typedef {{ moduleId: string, code: string, map?: string | null }} EmitModule
 * @typedef {Iterable<EmitModule>} ModuleCollection
 */
```

不含 range/sourceFile——错误定位（moduleRanges）是 bundle 策略在拼接布局时**私有生成**，不进模块属性（缓存了也随每次 emit 布局失效）。

## 4. transform 策略（D-E-2）

```js
// emit.js 内
const strategies = {
  bundle: {
    async apply(ctx, cfg) {
      // 整包拼接：modDefine 包裹 + moduleRanges 行映射（错误定位）
      // minify / target / platform 经 esbuild transform(bundleSource, {…})
    },
  },
  perModule: {
    async apply(ctx, cfg) {
      // 逐模块：每个 modDefine 单独 transform，天然错误定位（失败即该模块）
    },
  },
}
// emitEntry 通过 cfg.transform.strategy 选取，函数注入防伪抽象
```

两个策略都是"模块集合 → 单文件产物"的交互层；差异（整包 vs 逐模块、定位方式）封装在各自 apply。

## 5. output（D-E-7/D-E-8）

```js
// pipeline/output.js —— 唯一写盘出口（materialize 名不副实修复）
write({ path, content, map, collectOutput })  // collectOutput ? postMessage(M1) : mkdir+write
```

- collectOutput 路径：postMessage({ type:'output', entry })——与 BuildModel.add 形状一致；
- 直写路径：mkdir -p（原各引擎 mkdirSync 逻辑收口）+ writeFileSync；
- style 只调 write（D-E-8），不经 emitEntry。

## 6. 行为 0（R-E4）

- emitEntry/output 抽取出后，三引擎传原参数组合 → 产物字节不变（view moduleRanges 计算逻辑原样迁入 bundle 策略；logic 逐模块 transform 原样迁入 perModule 策略）。
- 验收 = 三链对拍 diff=0；vitest 全量。

## Residual

- 本刀不实现刀 2/刀 3（失效查询/ModuleCache）——契约接口已立，后续提供者守约即可。
- style 只收写盘（不建 emitEntry）——产物形态差异本质，收纳式重构。