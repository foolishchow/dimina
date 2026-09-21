# Validation — fe-tools-parse-walk-extract

## V-PW-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
结果：0 错。✅

## V-PW-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
结果：608/608 passed（82 test files）。✅

## V-PW-3 — 产物 diff（行为 0）

基线：`git stash` → `pnpm build` → 用 `build()` 构建测试项目（page + wx:for + wxss）。
新：`git stash pop` → `pnpm build` → 构建相同测试项目。

```bash
diff -r <baseline-out> <current-out>  # nomap + sourcemap
```
结果：diff=0。✅

## V-PW-4 — grep 验证

```bash
# style/parse-walk.ts 非 re-export
grep -c 'export.*from.*index' src/compiler/style/parse-walk.ts  # = 0 ✅

# view/parse-walk.ts 非 re-export
grep -c 'export.*from.*index' src/compiler/view/parse-walk.ts  # = 0 ✅

# style/index.ts 不含 parse+walk 函数定义
grep -c 'function enhanceCSS\|function buildCompileCss' src/compiler/style/index.ts  # = 0 ✅

# view/index.ts 不含 parse+walk 函数定义（含 transTagWxs）
grep -c 'function compileViewTree\|function compileModule\|function viewParseWalk\|function insertWxsToRenderResult\|function transTagWxs' src/compiler/view/index.ts  # = 0 ✅

# style/index.ts export 块保留（compileSS 留定义 + 7 re-export from parse-walk.ts）
grep -c 'export.*buildCompileCss\|export.*boostExternalClassSelectors\|export.*ensureImportSemicolons' src/compiler/style/index.ts  # ≥ 1 ✅

# view/index.ts export 块保留（compileML 留定义 + 9 re-export from parse-walk.ts + 3 from tools.ts + 1 from include.ts）
grep -c 'export.*viewParseWalk\|export.*parseBraceExp\|export.*processWxsContent' src/compiler/view/index.ts  # ≥ 1 ✅

# style/parse-walk.ts export clearStyleCaches（styleCompile cleanup 用）
grep -c 'clearStyleCaches' src/compiler/style/parse-walk.ts  # ≥ 1 ✅

# style/index.ts 不 import minifyCss（noUnusedLocals: true）
grep -c 'minifyCss' src/compiler/style/index.ts  # = 0 ✅

# style/index.ts import type { StyleModule, StyleOptions } from parse-walk.ts
grep -c 'import type.*StyleModule.*parse-walk' src/compiler/style/index.ts  # ≥ 1 ✅

# view/index.ts 不 import/不使用 templateRenderCache（noUnusedLocals: true; clearViewCaches 在 parse-walk.ts 处理；注释也不提及）
grep -c 'import.*templateRenderCache\|templateRenderCache\.' src/compiler/view/index.ts  # = 0 ✅

# view/parse-walk.ts export ensureWxsScan + resetWxsScan + clearViewCaches
grep -c 'ensureWxsScan\|resetWxsScan\|clearViewCaches' src/compiler/view/parse-walk.ts  # ≥ 3 ✅

# view/index.ts import type { ViewModule } from parse-walk.ts
grep -c 'import type.*ViewModule.*parse-walk' src/compiler/view/index.ts  # ≥ 1 ✅

# 无循环依赖
grep -rn "from './index'" src/compiler/style/parse-walk.ts src/compiler/view/parse-walk.ts  # = 0 ✅

# W1 binding 全覆盖（两套 shim）
grep -c 'bindVueToolsLive' src/compiler/view/index.ts  # ≥ 1 ✅
grep -c 'bindTransformOrchestrator' src/compiler/view/index.ts  # ≥ 1 ✅
```

## V-PW-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
结果：47 Actions, 0 errors, 0 warnings。✅
