# Validation — fe-tools-graph-bootstrap

## V-GB-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 errors。

## V-GB-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：全绿（608+ tests）。

## V-GB-3 — 行为 0（diff=0）

```bash
# nomap 产物
git diff --stat -- fe/tools/bundler/__dist__/  # 或产物对比目录
# sourcemap 产物
git diff --stat -- fe/tools/bundler/__dist_sourcemap__/
```
预期：empty（无改动）。

## V-GB-4 — 类型约束 grep

```bash
cd fe/tools/bundler/src/packer
grep -c ': any\b\|as any\b\|@ts-nocheck' graph.ts            # = 0
grep -c '\[key: string\]' graph.ts                           # = 0
```

## V-GB-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
