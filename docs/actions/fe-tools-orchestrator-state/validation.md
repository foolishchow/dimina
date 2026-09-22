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
预期：全绿（608+ tests）。含 watch-runner.spec.js（mock 测例需更新：注入 mock state 替代 mock store.getDependencyGraph）。

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

**方案**：用 `examples/miniprogram/base`，先 full build 保存产物，再启动 watch → 触发文件变更 → rebuild → 比对 rebuild 产物与 full build 产物。

```bash
# 1. Full build → 保存 baseline
rm -rf /tmp/os-watch-full
node --input-type=module -e "
import build from './dist/index.js';
await build('/tmp/os-watch-full', '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base', true, {});
console.log('full build done');
"
cp -r /tmp/os-watch-full /tmp/os-watch-baseline

# 2. Watch build → 触发 rebuild
#    启动 dev-server 或直接调 createBuildWatcher
#    触发文件变更（e.g., touch/modify a .js file in examples/miniprogram/base）
#    等 rebuild 完成

# 3. 比对
diff -r /tmp/os-watch-baseline /tmp/os-watch-full
echo "watch rebuild diff: $?"
```
预期：diff=0（watch rebuild 产物 = full build 产物）。

**补充**：watch-runner.spec.js 增量路径测例 pass（注入 mock state.graph，验证 hasFile() → tracked → incremental: true）。

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
