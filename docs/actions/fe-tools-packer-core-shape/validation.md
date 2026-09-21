# Validation — fe-tools-packer-core-shape

## V-PCS-1 — tsc

```bash
cd fe/tools/bundler && npx tsc --noEmit --pretty
```
预期：0 错（含 `src/packer/types.ts` 新文件）。

## V-PCS-2 — vitest 全量

```bash
cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test
```
预期：全绿。新文件不影响现有测试。

## V-PCS-3 — 行为 0（diff=0）

```bash
git diff --stat
```
预期：仅 2 新文件（`src/packer/types.ts` + `src/packer/README.md`），无现有文件改动。

## V-PCS-4 — grep 验证

```bash
cd fe/tools/bundler/src/packer

# A-PCS-1: PackerContext 定义（D-PCS-6: 不含 graph/cache）
grep -c 'interface PackerContext' types.ts                    # ≥ 1
grep -c 'workPath.*string' types.ts                           # ≥ 1
grep -c 'getComponent' types.ts                               # = 0

# A-PCS-2: LoadedModule + CompiledModule（D-PCS-10: discriminated union）
grep -c 'interface LoadedModule' types.ts                     # ≥ 1
grep -c 'interface CompiledModuleBase' types.ts               # ≥ 1
grep -c 'LogicCompiledModule' types.ts                        # ≥ 1
grep -c 'ViewCompiledModule' types.ts                         # ≥ 1
grep -c 'StyleCompiledModule' types.ts                       # ≥ 1
grep -c 'ModuleKind' types.ts                                 # ≥ 1

# A-PCS-3: 3 registry（D-PCS-5/D-PCS-7）
grep -c 'interface Loader' types.ts                           # ≥ 1
grep -c 'interface Compiler' types.ts                         # ≥ 1
grep -c 'interface Emitter' types.ts                           # ≥ 1
grep -c 'EmitStrategy' types.ts                               # ≥ 1
grep -c 'interface EmitBucket' types.ts                       # ≥ 1
grep -c 'LoaderRegistry' types.ts                             # ≥ 1
grep -c 'CompileRegistry' types.ts                            # ≥ 1
grep -c 'EmitRegistry' types.ts                               # ≥ 1
grep -c 'import type.*EmitEntry' types.ts                     # ≥ 1

# A-PCS-4: Graph + OrchestratorState（D-PCS-2, D-PCS-3, D-PCS-4, D-PCS-6, D-PCS-9）
grep -c 'interface Graph' types.ts                            # ≥ 1
grep -c 'buildFromProjectModel\|build(ctx\|\.build(' types.ts  # ≥ 0（build 方法）
grep -c 'mergeDelta' types.ts                                 # ≥ 1
grep -c 'interface OrchestratorState' types.ts                # ≥ 1
grep -c 'ModuleResultCache' types.ts                          # ≥ 1
grep -c 'invalidatedModules' types.ts                         # ≥ 1

# A-PCS-5: Orchestrator（D-PCS-5, D-PCS-8, D-PCS-9）
grep -c 'interface PackerOrchestrator' types.ts              # ≥ 1
grep -c 'orchestrate' types.ts                               # ≥ 1
grep -c 'loaderRegistry' types.ts                            # ≥ 1
grep -c 'compileRegistry' types.ts                            # ≥ 1
grep -c 'emitRegistry' types.ts                              # ≥ 1

# A-PCS-9: 无 any / @ts-nocheck / as any / 索引签名
grep -c ': any\b\|as any\b\|@ts-nocheck' types.ts            # = 0
grep -c '\[key: string\]' types.ts                           # = 0

# A-PCS-6/7: README 边界 + 管线 + 映射
grep -c 'load.*compile.*emit' README.md                      # ≥ 1
grep -c 'Packer.*通用' README.md                             # ≥ 1
grep -c 'Scheme.*Dimina' README.md                           # ≥ 1
grep -c 'env.ts' README.md                                   # ≥ 1
grep -c 'parse-walk.*load\|Loader' README.md                 # ≥ 1
```

## V-PCS-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings。
