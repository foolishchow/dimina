# Validation — fe-tools-graph-bootstrap

## V-GB-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 errors。

**结果**：✅ 0 errors（2026-09-22, commit 960a5dd7）

## V-GB-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：全绿（608+ tests）。

**结果**：✅ 608/608 pass（compile-cli-cache.spec.js flaky timeout 单独重跑 pass — 非回归，已知问题）

## V-GB-3 — 行为 0（diff=0）

```bash
# baseline build (stash changes → rebuild dist → build)
rm -rf /tmp/graph-baseline
node /tmp/build-baseline.mjs   # import build from dist; build to /tmp/graph-baseline

# new build (unstash → rebuild dist → build)
rm -rf /tmp/graph-new
node /tmp/build-new.mjs         # import build from dist; build to /tmp/graph-new

diff -r /tmp/graph-baseline /tmp/graph-new
```
预期：empty（无改动）。

**结果**：✅ `diff -r /tmp/graph-baseline /tmp/graph-new` = 0（examples/miniprogram/base 产物完全一致）

## V-GB-4 — 类型约束 grep

```bash
cd fe/tools/bundler/src/packer
grep -c ': any\b\|as any\b\|@ts-nocheck' graph.ts            # = 0
grep -c '\[key: string\]' graph.ts                           # = 0
```

**结果**：✅ 0 / 0（graph.ts 无 any/as any/@ts-nocheck/[key: string]）

```bash
cd fe/tools/bundler
git diff src/compiler/core/env.ts | grep '^+' | grep -E '\bany\b|@ts-nocheck|\[key: string\]'
```
**结果**：✅ 0 matches（env.ts 新增代码无 any/@ts-nocheck/[key: string]）

## V-GB-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。

**结果**：✅ 0 errors, 0 warnings
