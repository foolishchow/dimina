# Validation — fe-tools-emit-transform-split

## V-ET-1 — tsc

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs build
```
结果：✅ 0 错。

## V-ET-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
结果：✅ 608/608 passed（82 test files）。

## V-ET-3 — 产物 diff（行为 0）

基线：实施前 commit（`aebd0959`），`git stash` + 移除新增文件 → `pnpm build` → 构建测试项目。
新：恢复 stash + `pnpm build` → 构建相同测试项目。

测试项目 1（basic）：page + component（wxs file）+ page with include
测试项目 2（extended）：main + sub package，page + 2 components（wxs file + inline wxs），page with include

```bash
diff -r <baseline> <current>  # nomap + sourcemap
```
结果：✅ diff=0（两组测试项目 × nomap + sourcemap = 4 组全 diff=0）。

## V-ET-4 — grep 残留检查

```bash
grep -n 'parseSync\|walk.*oxc\|from .esbuild.' src/compiler/logic/index.ts
grep -n 'from .esbuild.' src/compiler/style/index.ts
grep -rn 'compileModuleWithAllWxs' src/  # 仅注释命中
grep -rn "from 'esbuild'" src/compiler/  # 只在 transform.ts, emit.ts, pipeline/emit.ts
```
结果：✅ 全通过（`logic/index.ts` 无 parseSync/walk/esbuild；`style/index.ts` 无 esbuild；`compileModuleWithAllWxs` 仅注释命中；esbuild 仅在 `logic/transform.ts`、`style/emit.ts`、`pipeline/emit.ts`）。

## V-ET-5 — style 四路径 diff

| 路径 | 验证 | 结果 |
| --- | --- | --- |
| sourcemap=true+minify | cssnano 在 postcss pass 内 | ✅ diff=0 |
| sourcemap=true+no-minify | postcss 无 cssnano | ✅ diff=0 |
| sourcemap=false+minify | `minifyCss` per-module（从 `emit.ts` 导入） | ✅ diff=0 |
| sourcemap=false+no-minify | 无 cssnano + 无 esbuild | ✅ diff=0 |

**行为 0 修正**：esbuild CSS minify 须 per-module（`minifyCss` 在 `enhanceCSS` 内调用），不能在 `emitStyle` 对聚合 CSS 做 minify。原因：per-module minify + join 保留模块间 `\n`（esbuild 输出尾 `\n`），aggregated minify 会删 `\n` → diff≠0。

## V-ET-6 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
结果：✅ 46 Actions, 0 errors, 0 warnings。

## V-ET-7 — view page sourcemap 风险验证

**TD 原设计**：page sourcemap 总是用 `createLineSourcemap`（匹配 `compileModuleWithAllWxs` 第二遍）。

**实施结果**：page sourcemap 改为**条件**用 `createLineSourcemap`：
- 2nd pass（`allScriptModules` provided）：`createLineSourcemap`（匹配 `compileModuleWithAllWxs`）
- 1st pass + components（`allScriptModules` undefined）：条件 `createOriginsSourcemap`/`createLineSourcemap`（不变）

**原因**：pages with `<include>` but no `<wxs>` 不触发 2nd pass（`allScriptModules.length === 0`），最终 sourcemap 来自 1st pass。若 1st pass 改用 `createLineSourcemap`，`include` 的 `origins` 信息丢失 → sourcemap diff≠0（`wxml-sourcemap.spec.js` 失败）。

**`collectAllWxsModules` 保留**：TD 原设计删 `collectAllWxsModules`（缓存读 + 非缓存路径），但实施发现 `collectAllWxsModules` 收集缓存泄漏的 wxs 模块（跨页面缓存中 `instruction.scriptModule` 含其他页面组件的 wxs）。删除后 sub-package 页面产物缺少泄漏 wxs → diff≠0。保留以维持行为 0。
