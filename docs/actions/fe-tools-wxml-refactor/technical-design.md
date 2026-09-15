# Technical Design — fe-tools-wxml-refactor

Status: **冻结 v1（2026-09-15）** — D-WR-1..9 已拍板；与 requirements / plan / acceptance 同步修改。

## 1. 目标形状

```text
WXML source
  ├─ parser/cheerio.js ─┐
  └─ parser/napi.js   ──┴→ 标准 JS Document（Rust AST shape + JS mutable）
                              ↓
                    transform / LoadedGraph / vue backend
```

cheerio 与 napi 都必须产出同一枚举面。cheerio 是投影工具，不向 transform/backend 暴露 `_$`、`_elem` 或 cheerio API。

## 2. 标准 Document contract

字段以 `docs/wxml/WXML-AST-TYPES.md` 为真源，JS 使用可变数组：

```js
Document { span, body, sourceFile }
Element  { type: 'element', span, name, attrs: Attr[], directives: [],
           slot: null, children: [], selfClosing: false }
Attr     { span: null|Span, name, value: null|Value }
Value    { kind: 'static'|'expr'|'template', raw, span, parts? }
```

特殊节点的 `type` 为 `wxs | template-def | template-ref | import | include | slot`，各自字段按 AST contract 映射。`null` 表示有意义但不可得；`[]` 表示空集合；字段不得因 parser 能力差异而缺失。JS 可变不代表 Rust AST 可变性迁移：W2 的 `replace/remove` 直接操作 JS 数组。

cheerio 缺失的属性级 span 可以为 `null`；节点 span、节点类型、名称、children、attrs 数组等结构字段必须存在。

## 3. W1：函数归位

精确集合为 23 个顶层函数：transform 10 个 + Vue backend 工具 13 个。`transTagWxs` 按 layering 归属留在 wxs 轨道，不混入本门。

```text
view/wxml/transform/
  index.js       展开/收集接线函数
  paths.js       路径函数
view/wxml/backends/
  vue-tools.js   Vue 降级工具函数
```

当前 23 个函数均为顶层定义，允许逐函数搬迁，函数体逐字保持。新模块导出函数，`view/index.js` 重新导入并继续组装现有 `ctx.tools`。模块级依赖直接改为稳定路径；尚未归位的 expression/wxs/asset 辅助函数采用过渡 re-export/live binding，禁止在此门改其函数体、签名或语义。模块加载测试必须覆盖 ESM worker 图，避免 TDZ：跨模块函数只在编译调用时解析，不在模块初始化期调用。

## 4. W2：标准形状与 cheerio 封装

### 4.1 parser 层

- `parser/cheerio.js`：cheerio load、遍历、属性解析、Value 分类、特殊节点分类、Document 序列化/结构操作。
- `parser/napi.js`：SpanView → 标准 Document 的递归构造；不做第二套 AST。
- `document.js`：标准工厂、节点访问/修改方法、plain snapshot 与语义比较辅助。
- `load.js`：只消费 Document 操作面；include/import 展开后的数组替换由 Document 方法完成。
- `backends/vue.js`：只消费 Document 序列化/遍历与 origin 信息，不直接 import cheerio。

Document 操作面不是通用 DOM API；仅覆盖既有算法实际需要的操作：按类型/标签查询、属性读取、根/子节点遍历、节点替换/删除、wrapper 创建、节点/文档序列化及 source-origin 读取。

### 4.2 特殊节点

特殊节点从 parser 阶段分类：`<include>` 即使缺少 `src` 仍为 `{type:'include', src:null}`；不再用 `name === ...` 作为语义判别。`templateNodeKind` 等旧二次猜测在所有消费者迁移后删除。

### 4.3 行源与序列化

标准 Document 保存 span/sourceFile；include/import 节点展开时保留 origin。Vue backend 从标准序列化结果生成 line origins；跨文件来源使用真实 source/span。W2 不要求中间 Document JSON 与旧投影字节相等，只要求最终产物和 sourcemap 等价。

## 5. W3：napi 默认装配

`parser/index.js` 根据 `process.env.WXML_PARSER ?? 'napi'` 选择 parser；只接受 `napi` 或 `cheerio`，非法值以 `[wxml]` 错误失败。napi 直接调用 `parseWxmlSpanView` 并构造标准 Document。默认 napi，cheerio 为显式回退与对拍基线。

两路对拍比较：节点 type/name、attrs 名和值分类、directives、特殊节点字段、可用 span；cheerio 属性 span 为 null 不构成不等价。最终以同一 fixture 编译的 code 与 sourcemap diff=0 为硬门。

## 6. 失败与边界

所有 parser/load/backend 错误带 `[wxml]`，尽量带 sourceFile 与 span。表达式 `.expr` 不进入 JS Document；保留 raw。纯 transform 产新树、表达式消费、第二 backend、logic/style/wxs 其他函数归位另立 Action。