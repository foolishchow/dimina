# Validation — fe-tools-als-store

## V-AS-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 errors。

## V-AS-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：全绿（608+ tests）。

## V-AS-3 — 行为 0（diff=0）

```bash
# nomap 产物
git diff --stat -- fe/tools/bundler/__dist__/  # 或产物对比目录
# sourcemap 产物
git diff --stat -- fe/tools/bundler/__dist_sourcemap__/
```
预期：empty（无改动）。

## V-AS-4 — 类型约束 grep

```bash
cd fe/tools/bundler
grep -rn ': any\b\|as any\b\|@ts-nocheck' src/compiler/worker-runtime/async-context-store.ts src/compiler/worker-runtime/context.ts  # = 0
grep -c '\[key: string\]' src/compiler/worker-runtime/async-context-store.ts  # = 0
# abilityContext 类型不是 unknown/any
grep 'abilityContext\|abilityALS' src/compiler/worker-runtime/context.ts  # 应有类型标注
```

## V-AS-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
