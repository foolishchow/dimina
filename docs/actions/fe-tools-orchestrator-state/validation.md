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

**方案**：用 `examples/miniprogram/base`，先 full build 保存产物，再用 watch 模式触发 rebuild，比对接收产物。

```bash
# 1. Full build → 保存 baseline
rm -rf /tmp/os-watch-full
cat > /tmp/os-watch-full.mjs << 'SCRIPT'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/dist/index.js';
await build('/tmp/os-watch-full', '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base', true, {});
console.log('full build done');
SCRIPT
node /tmp/os-watch-full.mjs
cp -r /tmp/os-watch-full /tmp/os-watch-baseline

# 2. Watch rebuild：用脚本调 createBuildWatcher + 触发文件变更
cat > /tmp/os-watch-rebuild.mjs << 'SCRIPT'
import { createBuildWatcher } from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/dist/watch/watch-runner.js';
import fs from 'node:fs';

const watcher = createBuildWatcher({
  targetPath: '/tmp/os-watch-full',
  workPath: '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base',
  useAppIdDir: true,
});
await watcher.start();

// 触发一个 .js 文件变更（touch 不改内容 → 增量路径）
const targetFile = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base/pages/index/index.js';
const content = fs.readFileSync(targetFile, 'utf-8');
fs.writeFileSync(targetFile, content); // 写回相同内容

await Promise.race([
  watcher.waitForIdle(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('watch rebuild timeout — chokidar may not have detected the content-identical write')), 10000)),
]);
await watcher.stop();
console.log('rebuild done');
SCRIPT
node /tmp/os-watch-rebuild.mjs

# 3. 比对
diff -r /tmp/os-watch-baseline /tmp/os-watch-full
echo "watch rebuild diff: $?"
```
预期：diff=0（watch rebuild 产物 = full build 产物）。

**补充**：watch-runner.spec.js 增量路径测例 pass（注入 mock state.graph，验证 hasFile() → tracked → incremental: true）。

## V-OS-5 — 类型约束 grep

覆盖全部 4 个交付物（R-OS-7 适用范围）。新文件必须是 0；已有文件不得新增。

```bash
# 1. 新文件 session-state.ts：必须 = 0
cd fe/tools/bundler/src/packer
grep -c ': any\b\|as any\b\|@ts-nocheck' session-state.ts    # = 0
grep -c '\[key: string\]' session-state.ts                   # = 0

# 2. 已有文件：不新增（baseline vs current，diff 必须 = 0）
for f in \
  src/compiler/core/env.ts \
  src/compiler/pipeline/build-pipeline.ts \
  src/watch/watch-runner.ts; do
  base=$(git show HEAD~1:"fe/tools/bundler/$f" 2>/dev/null | grep -c ': any\b\|as any\b\|@ts-nocheck\|\[key: string\]' || echo 0)
  curr=$(grep -c ': any\b\|as any\b\|@ts-nocheck\|\[key: string\]' "fe/tools/bundler/$f" || echo 0)
  echo "$f: baseline=$base current=$curr"
  [ "$base" = "$curr" ] || echo "  ⚠ MISMATCH — new instances introduced"
done
```
预期：session-state.ts 全 0；已有文件 baseline = current（不新增）。

## V-OS-6 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
