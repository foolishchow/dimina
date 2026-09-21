# Validation — fe-tools-incremental-unify

## V-IU-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 errors。

## V-IU-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：全绿（608+ tests）。

## V-IU-3 — 行为 0（diff=0）

```bash
# nomap 产物
git diff --stat -- fe/tools/bundler/__dist__/  # 或产物对比目录
# sourcemap 产物
git diff --stat -- fe/tools/bundler/__dist_sourcemap__/
```
预期：empty（无改动）。

## V-IU-4 — 类型约束 grep

```bash
cd fe/tools/bundler
grep -rn ': any\b\|as any\b\|@ts-nocheck' src/model/invalidation.ts src/model/module-result-cache.ts src/compiler/view/parse-walk.ts src/compiler/style/parse-walk.ts  # = 0 matches
grep -c '\[key: string\]' src/model/invalidation.ts src/model/module-result-cache.ts  # = 0
```

## V-IU-5 — 模块级增量 grep

```bash
# 确认 logic 硬编码已移除
grep -n "'logic'" src/model/dependency-graph.ts | grep -i "invalidated\|getDirectDependents"  # 应无匹配 in getInvalidatedModules
# 确认 view/style cache 存在
grep -rn "viewCache\|styleCache\|ModuleResultCache" src/watch/  # view/style cache 实例
```

## V-IU-6 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
