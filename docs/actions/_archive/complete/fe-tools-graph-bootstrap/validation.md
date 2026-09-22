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

全量验证：7 个 examples/miniprogram/* 项目逐一构建 baseline vs new，逐个 diff -r。

```bash
# baseline: checkout parent commit env.ts (无 graph.ts) → rebuild dist → build all
# new:      current HEAD (PackerGraph) → rebuild dist → build all

for proj in air-battle base mpx-demo subpackages taro-todo vant weui; do
  rm -rf /tmp/gb-baseline-$proj /tmp/gb-new-$proj
  node /tmp/gb-build-baseline-$proj.mjs   # build to /tmp/gb-baseline-$proj
  node /tmp/gb-build-$proj.mjs            # build to /tmp/gb-new-$proj
  diff -r /tmp/gb-baseline-$proj /tmp/gb-new-$proj
  echo "$proj: $?"
done
```
预期：全部 diff=0。

**结果**：✅ 7/7 项目全 diff=0（共 896 个产物文件）

| 项目 | 产物文件数 | diff |
|---|---|---|
| air-battle | 2 | ✅ 0 |
| base | 94 | ✅ 0 |
| mpx-demo | 5 | ✅ 0 |
| subpackages | 166 | ✅ 0 |
| taro-todo | 5 | ✅ 0 |
| vant | 495 | ✅ 0 |
| weui | 129 | ✅ 0 |

baseline = parent commit `20b125af`（旧 storeInfo，无 graph.ts）；new = `960a5dd7`（PackerGraph 路 1 过渡态）。

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
