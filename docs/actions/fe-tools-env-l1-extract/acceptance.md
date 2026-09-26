# Acceptance — fe-tools-env-l1-extract

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-EL1-1 | R-EL1-1 | env-compute.ts L1 纯模块 | 新建 `src/packer/store/env-compute.ts` 承载常量 + normalizeFileTypes + computePathInfo + buildPackerContext + computeStoreInfo（返回含 npmResolver——F-R6-1）+ storeInfoCtx + buildResetStoreInfoData + getAppStyleScopeId + getContentByPath + PathInfo/ConfigInfo type；env-compute 不依赖 env.ts（无循环 import）；tsc 0 | done |
| A-EL1-2 | R-EL1-2 | env.ts 退化 L2/L3 门面 + re-export | env.ts = L2 ALS 门面（singleton/Proxy/getters/getPages）+ L3 resetStoreInfo + storeInfo wrapper（调 env-compute.computeStoreInfo + compat 写保留）+ re-export L1 + PathInfo/ConfigInfo re-export；消费方 import from env.ts 不变；storeInfo 签名/返回值不变（~107 调用点/34 测试文件不动）；tsc 0 | done |
| A-EL1-3 | R-EL1-3 | 死代码清理 | 删 5 死代码函数（storeProjectConfig/storeAppConfig/storePageConfig/createInitialDependencyGraph/storePathInfo）+ toPackerContext export + PageConfig/ComponentConfig re-export + getCompilerContext 改 internal；grep 5 函数 + toPackerContext 在 env.ts caller=0；**getPages 保留 env.ts L2**（测试 21 文件 47 调用点）；env.spec.js 改写 config-fixpoint.readProjectConfig 直测（保留合并覆盖）；tsc 0 | done |
| A-EL1-4 | R-EL1-4 | resolveAppAlias 迁出 | resolveAppAlias 迁 env-compute 收 appInfo 参数 `(src, appInfo)`；env.ts 保留 wrapper（选项 A 锁定——读 ALS appInfo + 调 env-compute，import alias）；parse-walk.ts:312 调用与 import 均不变；tsc 0 | done |
| A-EL1-5 | R-EL1-5 | 行为 0 | tsc 0 + vitest 88/88 + one-shot 7-diff=0（env.ts 全局路径→全量 7 项目） | done |
| A-EL1-6 | R-EL1-6 | Non-scope 守 | compat 写不动（storeInfo wrapper 保留）+ L2/L3 不动（getters/resetStoreInfo 保留）+ compiler/* 不动 + config-fixpoint 不动 + PackerContext dedup 不处理 + scratch 内化不处理 | done |
## backflow（P-EL1-3 后记录）

- 阶段 3（L2+L3 退役）：compiler/* 加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- scratch 内化：DiskOutput.publish 内化 mkdtemp
- PackerContext 构造 dedup（buildPackerContext/buildFixpointCtx/toPackerContext 三同质）
- compat 写保留（storeInfo wrapper——阶段 3 退役）
