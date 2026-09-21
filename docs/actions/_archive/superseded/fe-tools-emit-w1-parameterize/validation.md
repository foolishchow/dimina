# Validation — fe-tools-emit-w1-parameterize

## V-W1-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 错。

## V-W1-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：608/608 passed（82 test files）。

## V-W1-3 — 产物 diff（行为 0）

基线：`git stash` → `pnpm build` → 用 `build()` 构建测试项目（page + wx:for + wxss）。
新：`git stash pop` → `pnpm build` → 构建相同测试项目。

```bash
diff -r <baseline-out> <current-out>  # nomap + sourcemap
```
预期：diff=0。

## V-W1-4 — grep 验证

```bash
cd fe/tools/bundler/src/compiler

# A-W1-1: emit.ts 不 import env.ts
grep -c "from.*env.ts" pipeline/emit.ts           # = 0
grep -c 'getWorkPath' pipeline/emit.ts              # = 0

# A-W1-2: EmitEntryParams 含 workPath
grep -c 'workPath: string' pipeline/emit.ts         # ≥ 1

# A-W1-3: bundle 策略参数化
grep -c 'resolve(workPath' pipeline/emit.ts          # ≥ 1

# A-W1-4: view/index.ts 传入 workPath
grep -c 'workPath.*getWorkPath' view/index.ts        # ≥ 1

# A-W1-5: build-pipeline.ts 传入 workPath
grep -c 'workPath' pipeline/build-pipeline.ts        # ≥ 1

# A-W1-7: 无 any / @ts-nocheck / as any
grep -c ': any\b\|as any\b\|@ts-nocheck' pipeline/emit.ts  # = 0

# A-W1-8: 不新增文件
git diff --name-only -- src/compiler/pipeline/      # 仅 emit.ts
```

## V-W1-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
