# Validation — fe-tools-orchestrator-state

## V-OS-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
结果：**0 errors**（commit ec7f8353）。

## V-OS-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
结果：**608/608 pass**（82 files）。watch-runner.spec.js PS2 测例更新：注入 mock state.graph（替代 mock store.getDependencyGraph），验证 D-OS-3 plan 从 sessionState.graph 读活图。

## V-OS-3 — 行为 0：单次 build（7 examples diff=0）

baseline = parent commit（graph-bootstrap complete，stash implementation）；new = current commit（OrchestratorState implementation，rebuild dist）。

| 项目 | diff | 文件数 |
|---|---|---|
| air-battle | 0 | 2 |
| base | 0 | 94 |
| mpx-demo | 0 | 5 |
| subpackages | 0 | 166 |
| taro-todo | 0 | 5 |
| vant | 0 | 495 |
| weui | 0 | 129 |
| **合计** | **7/7 = 0** | **896** |

## V-OS-4 — 行为 0：watch rebuild 产物一致

结果：**diff=0**。用 `examples/miniprogram/base/pages/form/index.js`（content-identical write）触发增量 rebuild。full build 产物 vs watch rebuild 产物完全一致。

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

结果：
- `session-state.ts`：**0** violations（new file）
- `env.ts`：baseline=6 current=6（不新增）
- `build-pipeline.ts`：baseline=0 current=0（不新增）
- `watch-runner.ts`：baseline=3 current=3（不新增）

## V-OS-6 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
结果：**0 errors, 0 warnings**。
