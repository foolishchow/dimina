# Validation — fe-tools-bundler-strict-access

权威参考：[Experience-Review.md](../../Experience-Review.md)

## V-SA0 — tsconfig 选项

```bash
cd fe/tools/bundler
grep -c "noUncheckedIndexedAccess\|forceConsistentCasingInFileNames\|allowUnusedLabels" tsconfig.json  # 3
```

## V-SA1 — 编译 + lint

```bash
cd fe/tools/bundler
# tsc build（含全部 strict lint + noUncheckedIndexedAccess）
node pnpm.mjs exec tsc -p tsconfig.build.json 2>&1 | grep 'error TS' | wc -l  # 0
# tsc --noEmit 显式 lint
node pnpm.mjs exec tsc --noEmit --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch --noImplicitReturns --noImplicitOverride --noUncheckedIndexedAccess -p tsconfig.build.json 2>&1 | grep 'error TS' | wc -l  # 0
```

## V-SA2 — 行为 0

```bash
cd fe/tools/bundler
node pnpm.mjs run build 2>&1 | tail -1  # tsc build OK
node --experimental-strip-types /tmp/wr-gen-p06.mjs 2>&1 | tail -1  # 写入编译产物（脚本来源：ts-migration V-TM06）
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p06-$name/out && echo "$name ✓"; done  # 4× ✓
node pnpm.mjs exec vitest run 2>&1 | grep -E 'Test Files|Tests '  # 584/584
```

## V-SA3 — lint 不回退

```bash
cd fe/tools/bundler
grep -E "noUnusedLocals|noUnusedParameters|noFallthroughCasesInSwitch|noImplicitReturns|noImplicitOverride" tsconfig.json | wc -l  # 5 (strict 单独 grep)
grep "\"strict\": true" tsconfig.json | wc -l  # 1
# 合计 6 原有 + 3 新 = 9
```

## 验证映射

| A-SA | V-SA | 证据 |
| --- | --- | --- |
| A-SA0 | V-SA0 | grep tsconfig.json 3 选项 |
| A-SA1 | V-SA1 | tsc 0 错 |
| A-SA2 | V-SA2 | diff=0 + 584/584 |
| A-SA3 | V-SA3 | grep tsconfig.json 6 原有选项 + 3 新选项 |
