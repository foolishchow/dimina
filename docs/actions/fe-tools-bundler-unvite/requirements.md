# Requirements — fe-tools-bundler-unvite

## R-UV1（MUST）下线 Vite 自打包

`fe/tools/bundler` 的 `build` 脚本不得调用 `vite build`；不得再依赖 `vite.config.mjs` 完成自发布。

## R-UV2（MUST）自发布不使用 bundler

自发布流水线不得使用 esbuild/swc/Rollup/Vite 等工具的 **module graph bundling** 生成 `dist`（D-UV-1）。允许：目录镜像/拷贝、薄再导出文件、既有 sdk 资产复制。

## R-UV3（MUST）ESM 发布面可用

`package.json` 的 `bin`（`dimina-cli`）与既有 `exports` 子路径在 `build` 后可被 Node 解析并执行（含 `./watch` 稳定路径，D-UV-3）。

## R-UV4（MUST）Worker 可加载阶段脚本

`build()` 路径下 view/logic/style worker 仍能加载对应 `*-compiler.js`（相对运行中的入口 `import.meta.url`，D-UV-4）。

## R-UV5（MUST）sdk 资产仍随包

`copy-sdk-assets`（或等价）仍把 `@dimina/web-container-sdk` 运行时资产放入发布树内约定位置（现为 `dist/sdk`），供 `dimina-cli dev` 使用。

## R-UV6（MUST）回归

- `pnpm --filter @dimina/bundler test` 通过（或 validation 成文豁免单项并说明）；
- `dimina-cli` 版本与冷启动冒烟（或 bootstrap 等价命令）通过。

## R-UV7（MUST）语义不变

本门不故意改变小程序编译产物语义；不以「顺手重构 view-compiler」为交付。

## R-UV8（MUST）build-output 测例不依赖 Vite 自打包（D-UV-6）

`__tests__/build-output.spec.js` 不得调用 `vite.build` 或依赖 `vite.config.mjs`。默认：对 `build` 后的 `dist/core/view-compiler.js`（或镜像等价）断言无 Babel 运行时 `require(...)`。仅当该断言与其它门完全重复时才可删除文件，并在 validation 成文。

## Non-requirements

- TypeScript 迁移；bundler-core / plugin / IR；去掉 vitest；改 `packages/compiler`；推 didi。

