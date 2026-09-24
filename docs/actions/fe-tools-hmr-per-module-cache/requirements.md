# Requirements — fe-tools-hmr-per-module-cache

Status: **ready（2026-10-09）**

## 问题陈述

G5 per-page-bundle cache 阻碍 per-module HMR。单组件 recompile → 全 bundle re-emit（cache-miss 全量 viewParseWalk）。H3 反转粒度，使单组件 recompile → 单 module cache 更新。

## Goal

view/style cache per-page-bundle → per-module。单组件 recompile → 单 module cache 更新 → emit 时重建 bundle（字节一致）。

## Requirements

### R-PMC-1（MUST）— view cache per-module
viewCache `Map<string, ViewCompiledModule[]>` → `Map<string, ViewCompiledModule>`（per moduleId）。

### R-PMC-2（MUST）— style cache per-module
styleCache per-page → per-module（per moduleId）。

### R-PMC-3（MUST）— bundle 重建字节一致
emit 时 per-module → bundle 重建须保字节一致（序一致——D-PMC-1 策略）。

### R-PMC-4（MUST）— 行为 0
one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿。watch 字节恒等（per-module 派生 == per-page-bundle）。

### R-PMC-5（SHOULD）— per-module invalidation
单组件 dirty → 单 module cache-miss（非全 bundle miss）。

**⚠️ F-H3-2**：invalidation 触发按文件类型分——.wxml 改（结构变）→ order list 失效 + 全量 viewParseWalk；.js component 改（代码变）→ per-module cache 失效 only（order list 稳定）。

## Constraints

- **G5 P-G506 先例**：graph 重建不可行（direct-only + 无 wxs + 序不一致）
- **行为 0 三件套**：vitest + tsc + 6 项目 diff=0
- **one-shot 平凡**：one-shot 无 cache → H3 one-shot diff=0 平凡成立（风险在 watch）
- **logic cache 不动**：logic 已 per-module（ModuleResultCache）

## Non-scope

- per-module HMR push（H4）
- logic cache 粒度
- G5 设计改（complete immutable）
- runtime HMR API

## 依赖

- H2 `complete`（registry 实体化——compile 路径经 registry）
- G5 per-page-bundle（complete，H3 反转前置）
- HMR-compiler 伞 `ready`（D-HMR-4 须不同策略）
