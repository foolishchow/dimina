# Source Audit — fe-tools-module-cache

Status: `draft`（2026-09-10，基于 HEAD `f9375068` 的代码事实）

沉淀 worker 内缓存粒度现状的审计证据（讨论前置：module cache 颗粒化必须发生在主线程持久化之前——见 README Background）。

## 1. 现状 worker 缓存粒度（核心证据）

| 缓存 | 位置 | 当前 key / 寻址 | 粒度判定 |
| --- | --- | --- | --- |
| `templateRenderCache` | view worker | `path + sourceSig + scriptSig + tpl`（模板组合级） | ❌ **组合/entry 级**（整段模板组合的 render） |
| `compileResCache` | view worker | 按 `module.path`（**path 寻址**） | ❌ entry/单文件级，跨 build 不安全（注释已声明"直接按 module.path 做键的既有假设"） |
| `optionalChainingCache` | view worker | 按表达式 | ✅ 微 module 级（内容寻址） |
| `wxsFilePathMap` / `wxsModuleRegistry` | view worker | path/模块映射 | ❌ 路径绑定 |
| `compileRes` | style worker | path | ❌ entry/单文件级 |
| `processedModules` | logic worker | path Set（只记"已处理"） | ⚠️ 非结果缓存 |

**结论**：没有一个是干净的"单文件 → 单结果"纯 module 缓存。颗粒化是持久化（build-model）的前置——先固粒度再持久化，否则 key/失效/注入边界全要返工。

## 2. worker 生命周期（缓存为何"单 stage 即亡"）

- `runCompileInWorker`：`new Worker(...)` → 编译 → resolve 前 `terminateWorker()`（index.js:313/:368）
- `workerPool.runWorker` 只是并发槽位管理（cgroup 感知 maxWorkers 信号量），**非 worker 实例复用**
- → worker 内缓存生命周期 = 单次 stage 编译；跨 build 不存在

## 3. view 的"组合型编译"特征（颗粒化的结构约束）

```text
多 wxml（含 include/template 组合）→ 组合展开（cheerio 层）
  → 完整页面模板 → @vue/compiler-sfc compileTemplate → render
```

- 组合在前、编译在后——"单文件 parse"与"页面 render"之间隔着组合层
- 颗粒化模块层在不拆该结构的前提下 = 缓存"单文件级 parse/中间结果"（形态①）
- 拆组合/编译结构本身（形态②）属 TS-2 边界，本 Action 不碰

## 4. key 维度缺口（跨 build 持久化前的必须补齐项）

`templateRenderCache` 现有 key 在单 worker 单 stage 内安全（compileConfig 不变），跨 build 持久化时缺：

- `compileConfig`（minify：view 产物压缩与否）
- `esTarget.view`（esbuild transform target，view-compiler:346 明确使用）
- `fileTypes`（自定义模板扩展名）
- `renderer`（A4 未来；当前仅 webview）

→ 本 Action 的 key 内容寻址化必须纳入上述维度（gap③ inputHash 维度清单的 worker 侧落点）。

## 5. 沿用现有的纯函数缓存先例

- `optionalChainingCache` 已是内容寻址（可直接延续）
- `templateRenderCache` 带内容签名（补维度后可跨 build 安全）
- `compileResCache` 需从 path 寻址升级为内容寻址（或保持单 build 明确弃用跨 build）