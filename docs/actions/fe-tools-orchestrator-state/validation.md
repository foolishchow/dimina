# Validation — fe-tools-orchestrator-state

## V-OS-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 errors。

## V-OS-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：全绿（608+ tests）。含 watch-runner.spec.js（mock 测例需更新：store.getDependencyGraph → state.graph）。

## V-OS-3 — 行为 0：单次 build（7 examples diff=0）

```bash
# baseline = parent commit (graph-bootstrap complete)
# new = current commit (OrchestratorState)
for proj in air-battle base mpx-demo subpackages taro-todo vant weui; do
  rm -rf /tmp/os-baseline-$proj /tmp/os-new-$proj
  node /tmp/os-build-baseline-$proj.mjs
  node /tmp/os-build-$proj.mjs
  diff -r /tmp/os-baseline-$proj /tmp/os-new-$proj
  echo "$proj: $?"
done
```
预期：7/7 diff=0。

## V-OS-4 — 行为 0：watch rebuild 产物一致

```bash
# watch 模式：首次 build → 触发文件变更 → rebuild → 比对产物
# 方案 A：watch rebuild 产物 vs full rebuild 产物 diff=0
# 方案 B：watch-runner.spec.js 增量路径测例 pass（mock state.graph 替代 mock store）
```
预期：watch rebuild 产物 = full rebuild 产物。

## V-OS-5 — 类型约束 grep

```bash
cd fe/tools/bundler/src/packer
grep -c ': any\b\|as any\b\|@ts-nocheck' session-state.ts    # = 0
grep -c '\[key: string\]' session-state.ts                   # = 0
```

## V-OS-6 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
