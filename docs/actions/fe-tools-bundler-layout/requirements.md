# Requirements — fe-tools-bundler-layout

Status: `ready`（随 D-BL-1..8）

## R-BL1（MUST）双轴可读

归置后，主要源码目录须能用口诀区分：**build vs dev**、**session vs compiler**（另加最小 `shared/`）。验收以目录树 + 归属表为准。

## R-BL2（MUST）行为不变

搬家不得改变编译产物语义、CLI build/watch/dev 可观察行为。验证含全量 vitest；**nomap 产物字节等价 MUST**（D-BL-6）；sourcemap 对拍 SHOULD。

## R-BL3（MUST）`common/` 收敛

- **L2 闭合**：`src/common/` **目录移除**（或空目录不保留实现文件）。  
- **L1**：允许 re-export 垫片（D-BL-3）。  
- **禁止**往 `common/` 新增实现文件（D-BL-4；文档约定，L2 后自然消失）。

## R-BL4（MUST）公开面

既有 `package.json` `exports` 保持可用；`check-package-exports`（或现行等价）通过。本门 **不** 新增稳定子路径（D-BL-7）。

## R-BL5（MUST）归属表完整

[layout.draft.md](./layout.draft.md) 覆盖搬家前 `common/*` 与根上相关入口；无未决 OPEN。

## R-BL6（MUST）分门试点

**L1 必须先完成 `dev/` 整簇**（D-BL-5），回归通过后再 L2 铺开。

## Non-requirements

- IR / 阶段图抽出 / 算法改动；session 新 API；插件；拆 npm 包；改 `packages/*`。
