# Validation — fe-tools-view-parse-walk-cleanup

## V-VC-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 错。

## V-VC-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：608/608 passed（82 test files）。

## V-VC-3 — 产物 diff（行为 0）

基线：`git stash` → `pnpm build` → 用 `build()` 构建测试项目（page + wx:for + wxss）。
新：`git stash pop` → `pnpm build` → 构建相同测试项目。

```bash
diff -r <baseline-out> <current-out>  # nomap + sourcemap
```
预期：diff=0。

## V-VC-4 — grep 验证

```bash
cd fe/tools/bundler/src/compiler

# A-VC-1: compileResCache 已拆分
grep -c 'const compileResCache' view/parse-walk.ts                    # = 0
grep -c 'moduleCompileCache' view/parse-walk.ts                       # ≥ 1
grep -c 'moduleFailureCache' view/parse-walk.ts                       # ≥ 1
grep -c 'wxsContentCache' view/parse-walk.ts                           # ≥ 1
grep -c "typeof cacheData === 'string'" view/parse-walk.ts            # = 0
grep -c 'moduleCompileCache.clear\|moduleFailureCache.clear\|wxsContentCache.clear' view/parse-walk.ts  # = 3

# A-VC-2: CacheEntry type
grep -c 'interface ModuleCompileCacheEntry' view/parse-walk.ts        # ≥ 1

# A-VC-3: mergeWxsModules
grep -c 'function mergeWxsModules' view/parse-walk.ts                 # ≥ 1

# A-VC-4: compileModule 拆分
grep -c 'function tryModuleCache\|function compileModuleRender\|function finalizeModule' view/parse-walk.ts  # ≥ 3

# A-VC-5: processWxsContent 拆分
grep -c 'function replaceGetRegExp\|function replaceGetDate\|function replaceWxsRequire\|function replaceConstructor' view/parse-walk.ts  # ≥ 4

# A-VC-6: insertWxsToRenderResult 拆分
grep -c 'function buildWxsDeclarations\|function buildWxsReplacements\|function applyWxsReplacements' view/parse-walk.ts  # ≥ 3

# A-VC-8: 无跨车道 import
grep -c "from '\.\./logic" view/parse-walk.ts                         # = 0
grep -c "from '\.\./style" view/parse-walk.ts                         # = 0

# A-VC-9: 无 any / @ts-nocheck / as any
grep -c ': any\b\|as any\b\|@ts-nocheck' view/parse-walk.ts          # = 0

# A-VC-10: 不新增文件
git diff --name-only -- src/compiler/view/                           # 仅 view/parse-walk.ts

# W1 shim binding 不变（15 个 export 函数）
grep -c 'export function viewParseWalk' view/parse-walk.ts            # = 1
grep -c 'export function insertWxsToRenderResult' view/parse-walk.ts  # = 1
grep -c 'export function transTagWxs' view/parse-walk.ts              # = 1
grep -c 'export function transAsses' view/parse-walk.ts               # = 1
grep -c 'export function processIncludedFileWxsDependencies' view/parse-walk.ts  # = 1
grep -c 'export function ensureWxsScan' view/parse-walk.ts           # = 1
grep -c 'export function resetWxsScan' view/parse-walk.ts             # = 1
grep -c 'export function clearViewCaches' view/parse-walk.ts          # = 1
```

## V-VC-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
