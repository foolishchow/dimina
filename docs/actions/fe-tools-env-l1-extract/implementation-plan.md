# Implementation Plan — fe-tools-env-l1-extract

Status authority: [Action Status](../STATUS.md)

## 分相（行为 0 每相 gate）

### P-EL1-1 — env-compute.ts L1 纯函数迁入（A 批：添加）

1. 新建 `src/packer/store/env-compute.ts`
2. 迁常量（DEFAULT_*/RESERVED_EXTS/MINI_*_RUNTIME_TYPE）
3. 迁 fileTypes 规范化（normalizeExt/normalizeTag/mergeUnique/normalizeFileTypes + FileTypesInput type）
4. 迁 computePathInfo / buildPackerContext / buildResetStoreInfoData / getAppStyleScopeId / getContentByPath（纯函数，逐字搬迁）
5. 迁 CompilerContext type（internal）+ toPackerContext（internal）
6. 拆 computeStoreInfo（storeInfo 纯计算部分，无 compat 写）
7. 迁 storeInfoCtx（调 computeStoreInfo，设 state.scratch——**风险 D-EL1-3：去 compat 写，须 7-diff 验**）
8. 迁 resolveAppAlias（收 appInfo 参数——D-EL1-4 选项 A：env.ts wrapper 读 ALS）
9. tsc 0

### P-EL1-2 — env.ts 退化（B 批：wire）

1. env.ts import from env-compute
2. storeInfo wrapper：调 env-compute.computeStoreInfo + compat 写保留（getCompilerContext 写 6 条）+ return（签名/返回值不变）
3. resolveAppAlias wrapper（选项 A）：读 ALS appInfo + 调 env-compute.resolveAppAlias
4. re-export from env-compute：buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath
5. env.ts L2/L3 不动（getters/resetStoreInfo/singleton/Proxy 保留）
6. tsc 0

### P-EL1-3 — 死代码清理 + 测试调整（C 批：删）

1. 删 env.ts 5 薄壳函数（storeProjectConfig/storeAppConfig/storePageConfig/getPages/createInitialDependencyGraph）
2. 删 env.ts toPackerContext export（迁 env-compute internal，无外部 caller）
3. env.spec.js 改：storeProjectConfig describe → 测 config-fixpoint.readProjectConfig 直接（或删，config-fixpoint 自有测试覆盖）
4. tsc 0

### P-EL1-4 — 行为 0 全量验证

1. tsc 0（`node ./node_modules/typescript/bin/tsc --noEmit`）
2. vitest 88/88（flaky solo pass）
3. one-shot 7-diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）
4. grep env.ts L1 函数 caller=0（全迁 env-compute 或删）+ 死代码 caller=0

## 验证点

- P-EL1-1 后：env-compute.ts 独立可 import + tsc 0（env.ts 仍有旧函数副本？或同步迁？须 atomic）
- P-EL1-2 后：env.ts re-export 生效 + 消费方 import 不变 + tsc 0
- P-EL1-3 后：死代码 caller=0 + env.spec 绿
- P-EL1-4：行为 0 三件套绿

## 风险点

- **D-EL1-3 storeInfoCtx 去 compat 写**：P-EL1-1 步 7 后须 7-diff 验。若 ≠0，fallback：storeInfoCtx 留 env.ts（调 storeInfo wrapper，不迁 env-compute）。
- **P-EL1-1/P-EL1-2 atomic**：env-compute 新建 + env.ts re-export 须 atomic（否则 env.ts 旧函数 + env-compute 新函数并存，双源）。建议 P-EL1-1 + P-EL1-2 合并单 commit。
