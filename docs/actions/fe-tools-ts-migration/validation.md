# Validation — fe-tools-ts-migration

权威参考：[Experience-Review.md](../../Experience-Review.md)

## V-TM00 — baseline 记录

```bash
cd fe/tools/bundler
git rev-parse --short HEAD  # baseline commit
# 4 组产物（同 worker-runtime baseline 流程）
node /tmp/wr-gen-baseline.mjs
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584
```

## V-TM01 — core/ 8 文件

```bash
cd fe/tools/bundler
find src/compiler/core -name "*.js"  # 零
grep -rn "from '.*core/.*\.js'" src/compiler/  # 零（全改 .ts）
node /tmp/wr-gen-p01.mjs && for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p01-$name/out && echo "$name ✓"; done
```

## V-TM07 — 全量验证

```bash
cd fe/tools/bundler
find src/compiler -name "*.js"  # 零残留
grep -rn "from '.*\.js'" src/compiler/ | grep -v node_modules  # 零 .js import（除 src/ 外）
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-final-$name/out && echo "$name ✓"; done
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584
node pnpm.mjs run build 2>&1 | tail -3  # tsc OK
grep -n "experimental-strip-types" src/compiler/pipeline/stage-channel.js src/compiler/worker-runtime/executor.js  # worker strip-types 保留
```

## 验证映射

| A-TM | V-TM | 证据 |
| --- | --- | --- |
| A-TM0 | V-TM07 | find 零 .js |
| A-TM1 | V-TM07 | grep 零 .js import |
| A-TM2 | V-TM07 | __tests__ import .ts（D-TM-2 拍板后）|
| A-TM3 | V-TM07 | diff=0 + 584/584 + tsc |
| A-TM4 | V-TM07 | grep strip-types |
