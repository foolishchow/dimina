# Validation — fe-tools-ts-migration

权威参考：[Experience-Review.md](../../Experience-Review.md)

## V-TM00 — baseline 记录

```bash
cd fe/tools/bundler
git rev-parse --short HEAD  # baseline commit
# 4 组产物（同 worker-runtime baseline 流程）
cat > /tmp/wr-gen-baseline.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-baseline-${name}/out`, base, false, opts)
}
console.log('baseline done')
EOF
node /tmp/wr-gen-baseline.mjs
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584
node pnpm.mjs exec tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | wc -l  # 0（现状）
```

> **注意（R7 F26）**：baseline 脚本 `import src/index.js`——P-TM06 改 `index.js→index.ts` 后，验证脚本要改 `import src/index.ts` + `node --experimental-strip-types`（或 build dist 后跑 `dist/bin/index.js`）。

## V-TM01 — @typedef → TS type（P-TM01）

```bash
cd fe/tools/bundler
grep -rn "@typedef" src/  # 零（9→0）
node pnpm.mjs exec tsc --noEmit -p tsconfig.json --checkJs 2>&1 | grep "TS2305"  # 链式清零
node pnpm.mjs run build 2>&1 | tail -1  # tsc build OK
cat > /tmp/wr-gen-p01.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-p01-${name}/out`, base, false, opts)
}
EOF
node /tmp/wr-gen-p01.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p01-$name/out && echo "$name ✓"; done
```

## V-TM02 — shared/ + core/env.js（P-TM02）

```bash
cd fe/tools/bundler
find src/shared src/compiler/core -name "env.ts" -o -name "*.ts" | grep -E "shared/|core/env"  # 全 .ts
node pnpm.mjs exec tsc --noEmit -p tsconfig.json --checkJs 2>&1 | grep -E "src/(shared|compiler/core/env)" | wc -l  # 0（该阶段清零）
cat > /tmp/wr-gen-p02.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-p02-${name}/out`, base, false, opts)
}
EOF
node /tmp/wr-gen-p02.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p02-$name/out && echo "$name ✓"; done
```

## V-TM03 — core/ 其余 + worker-runtime/（P-TM03）

```bash
cd fe/tools/bundler
find src/compiler/core src/compiler/worker-runtime -name "*.js"  # 零
node pnpm.mjs exec tsc --noEmit -p tsconfig.json --checkJs 2>&1 | grep -E "src/compiler/(core|worker-runtime)" | wc -l  # 0
cat > /tmp/wr-gen-p03.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-p03-${name}/out`, base, false, opts)
}
EOF
node /tmp/wr-gen-p03.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p03-$name/out && echo "$name ✓"; done
```

## V-TM04 — pipeline/ + model/ + session/ + watch/（P-TM04）

```bash
cd fe/tools/bundler
find src/compiler/pipeline src/model src/session src/watch -name "*.js"  # 零
node pnpm.mjs exec tsc --noEmit -p tsconfig.json --checkJs 2>&1 | grep -E "src/(compiler/pipeline|model|session|watch)" | wc -l  # 0
cat > /tmp/wr-gen-p04.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-p04-${name}/out`, base, false, opts)
}
EOF
node /tmp/wr-gen-p04.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p04-$name/out && echo "$name ✓"; done
```

## V-TM05 — view/ + logic/ + style/（P-TM05）

```bash
cd fe/tools/bundler
find src/compiler/view src/compiler/logic src/compiler/style -name "*.js"  # 零
node pnpm.mjs exec tsc --noEmit -p tsconfig.json --checkJs 2>&1 | grep -E "src/compiler/(view|logic|style)" | wc -l  # 0
cat > /tmp/wr-gen-p05.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.js'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-p05-${name}/out`, base, false, opts)
}
EOF
node /tmp/wr-gen-p05.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p05-$name/out && echo "$name ✓"; done
```

## V-TM06 — bin/ + dev/ + src/根（P-TM06）

```bash
cd fe/tools/bundler
find src/bin src/dev src -maxdepth 1 -name "*.js"  # 零
node pnpm.mjs exec tsc --noEmit -p tsconfig.json --checkJs 2>&1 | grep "error TS" | wc -l  # 0（全 src 清零）n# 验证脚本 import 后缀调整（R7 F26）：src/index.js → src/index.ts + strip-types
cat > /tmp/wr-gen-p06.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.ts'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-p06-${name}/out`, base, false, opts)
}
EOF
node --experimental-strip-types /tmp/wr-gen-p06.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-p06-$name/out && echo "$name ✓"; done
```

## V-TM07 — __tests__/ import 后缀（P-TM07）

```bash
cd fe/tools/bundler
grep -rn "from '.*src/.*\.js'" __tests__/  # 零（全改 .ts）
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584
```

## V-TM08 — 全量验证（P-TM08）

```bash
cd fe/tools/bundler
find src -name "*.js"  # 零残留（72→0）
grep -rn "from '.*\.js'" src/ | grep -v node_modules  # 零 .js import in src（静态 from）
grep -rn "import('..*\.js')" src/ | grep -v node_modules  # 零 .js JSDoc import() 死引用（R35 F87）
grep -rn "@typedef" src/  # 零（9→0）
grep -rn ": any\b\|<any\|as any\|: any\b" src/  # 零 any
grep -n "experimental-strip-types" src/compiler/worker-runtime/executor.js  # worker strip-types 保留（new Worker only executor.js，D-WR-5）
# 验证脚本 import src/index.ts + strip-types（R7 F26）
cat > /tmp/wr-gen-final.mjs << 'EOF'
import build from '/Users/foolishchow/Workspaces/dimina/fe/tools/bundler/src/index.ts'
const base = '/Users/foolishchow/Workspaces/dimina/examples/miniprogram/base'
for (const [name, opts] of [['nomap',{sourcemap:false,minify:false}],['min-nomap',{sourcemap:false,minify:true}],['sm',{sourcemap:true,minify:false}],['sm-min',{sourcemap:true,minify:true}]]) {
  await build(`/tmp/wr-final-${name}/out`, base, false, opts)
}
EOF
node --experimental-strip-types /tmp/wr-gen-final.mjs
for name in nomap min-nomap sm sm-min; do diff -rq /tmp/wr-baseline-$name/out /tmp/wr-final-$name/out && echo "$name ✓"; done
node pnpm.mjs test 2>&1 | grep -E 'Test Files|Tests '  # 584/584
node pnpm.mjs run build 2>&1 | tail -1  # tsc strict OK
node pnpm.mjs exec tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | wc -l  # 0
```

## 验证映射

| A-TM | V-TM | 证据 |
| --- | --- | --- |
| A-TM0 | V-TM08 | find 零 .js in src |
| A-TM1 | V-TM08 | grep 零 .js import in src |
| A-TM2 | V-TM07 | __tests__ import .ts |
| A-TM3 | V-TM08 | diff=0 + 584/584 + tsc |
| A-TM4 | V-TM08 | grep strip-types |
| A-TM5 | V-TM08 | grep 零 @typedef + 零 any + tsc strict |
