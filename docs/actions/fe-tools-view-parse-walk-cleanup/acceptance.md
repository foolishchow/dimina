# Acceptance — fe-tools-view-parse-walk-cleanup

## A-VC-1 — `compileResCache` 拆分为 3 个独立 Map

- [ ] `view/parse-walk.ts` 不含 `compileResCache` 变量定义（`grep -c 'const compileResCache' parse-walk.ts` = 0）
- [ ] `view/parse-walk.ts` 含 3 个独立 Map：`moduleCompileCache` / `moduleFailureCache` / `wxsContentCache`
- [ ] `moduleCompileCache` 类型为 `Map<string, ModuleCompileCacheEntry>`（非 `Map<string, unknown>`）
- [ ] `moduleFailureCache` 类型为 `Map<string, ErrorShape>`（非 `Map<string, unknown>`）
- [ ] `wxsContentCache` 类型为 `Map<string, string>`（非 `Map<string, unknown>`）
- [ ] `view/parse-walk.ts` 不含 `typeof cacheData === 'string'` 旧格式兼容分支（`grep -c "typeof cacheData === 'string'" parse-walk.ts` = 0）
- [ ] `clearViewCaches` 清 3 个 Map（`grep -c 'moduleCompileCache.clear\|moduleFailureCache.clear\|wxsContentCache.clear' parse-walk.ts` = 3）

## A-VC-2 — 定义 `CacheEntry` union type

- [ ] `view/parse-walk.ts` 含 `interface ModuleCompileCacheEntry { code: string; instruction: Record<string, unknown>; map: string | null }`
- [ ] `view/parse-walk.ts` 缓存条目读取不使用 `as` 断言（`grep -c 'as (Record.*CacheEntry\|as.*cacheData' parse-walk.ts` = 0 或仅 type import）

## A-VC-3 — `collectAllWxsModules` 重复调用提取为公共函数

- [ ] `view/parse-walk.ts` 含 `mergeWxsModules` 或等效公共函数
- [ ] `compileModule` 内不直接内联 `collectAllWxsModules` + 合并逻辑（两处重复消除）
- [ ] `mergeWxsModules` 为模块私有（不 export）

## A-VC-4 — `compileModule` 拆分

- [ ] `view/parse-walk.ts` 含 `tryModuleCache` / `compileModuleRender` / `finalizeModule` 或等效子函数
- [ ] `compileModule` 函数体 ≤30 行（薄编排）
- [ ] 各子函数 ≤80 行
- [ ] 子函数为模块私有（不 export）

## A-VC-5 — `processWxsContent` 按转换类型拆分

- [ ] `view/parse-walk.ts` 含 `replaceGetRegExp` / `replaceGetDate` / `replaceWxsRequire` / `replaceConstructor` 或等效子函数
- [ ] `processWxsContent` 函数体 ≤40 行（walk 回调分派）
- [ ] 各子函数 ≤40 行
- [ ] 子函数为模块私有（不 export）

## A-VC-6 — `insertWxsToRenderResult` 拆分

- [ ] `view/parse-walk.ts` 含 `buildWxsDeclarations` / `buildWxsReplacements` / `applyWxsReplacements` 或等效子函数
- [ ] `insertWxsToRenderResult` 函数体 ≤20 行（薄编排）
- [ ] 各子函数 ≤50 行
- [ ] 子函数为模块私有（不 export）

## A-VC-7 — 行为 0

- [ ] tsc 0 错
- [ ] 全量 vitest 绿（608/608）
- [ ] nomap 产物 diff=0
- [ ] sourcemap 产物 diff=0

## A-VC-8 — 无跨车道 import

- [ ] `view/parse-walk.ts` 不 import from `../logic/`（`grep -c "from '\.\./logic" parse-walk.ts` = 0）
- [ ] `view/parse-walk.ts` 不 import from `../style/`（`grep -c "from '\.\./style" parse-walk.ts` = 0）

## A-VC-9 — 无 `any` / `@ts-nocheck` / `as any`

- [ ] `view/parse-walk.ts` 不含 `: any` / `as any` / `@ts-nocheck`（`grep -c ': any\b\|as any\b\|@ts-nocheck' parse-walk.ts` = 0）

## A-VC-10 — 不新增文件

- [ ] `view/` 目录下不新增 `.ts` 文件（`git diff --name-only` 中 `view/` 下无新增文件，仅 `view/parse-walk.ts` 改动）
