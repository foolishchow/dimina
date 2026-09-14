# WXML Language Specification

**Version:** 1.0 (Draft)  
**Date:** 2026-06-26  
**Purpose:** 记录 WXML 语言的完整语法规范，基于微信小程序官方文档

## 0. 概述

WXML (WeiXin Markup Language) 是微信小程序的模板语言，类似于 HTML 但有以下特点：
- 数据绑定：`{{}}` 插值语法
- 条件渲染：`wx:if`、`wx:elif`、`wx:else`
- 列表渲染：`wx:for`、`wx:key`
- 模板系统：`<template>`、`<import>`、`<include>`
- 事件绑定：`bind:`、`catch:`
- WXS 模块：`<wxs>` 嵌入式脚本

## 1. 节点类型

### 1.1 元素节点 (Element Node)

**语法：**
```wxml
<tag-name attributes>
  children
</tag-name>
```

**自闭合语法：**
```wxml
<tag-name attributes />
```

**标签名规则：**
- 小写字母、数字、连字符（-）
- 必须以小写字母开头
- 示例：`view`, `text`, `scroll-view`, `custom-component`

**组件分类：**
- 基础组件：`view`, `text`, `image`, `button`, `input` 等
- 容器组件：`scroll-view`, `swiper`, `movable-view` 等
- 表单组件：`form`, `input`, `checkbox`, `radio`, `slider` 等
- 自定义组件：用户定义的组件

### 1.2 文本节点 (Text Node)

**纯文本：**
```wxml
<view>Hello World</view>
```

**插值表达式：**
```wxml
<view>{{message}}</view>
```

**复合文本：**
```wxml
<view>Hello {{name}}, welcome!</view>
```

### 1.3 注释节点 (Comment Node)

**标准注释：**
```wxml
<!-- 这是注释 -->
```

## 2. 属性系统

### 2.1 静态属性

**语法：**
```wxml
<view class="container" id="main"></view>
```

**引号规则：**
- 推荐使用双引号 `"..."`（标准做法）
- 也接受单引号 `'...'`（与 HTML 标准兼容）
- 不支持无引号属性值

### 2.2 动态属性（数据绑定）

**语法：**
```wxml
<view class="{{className}}"></view>
<view style="color: {{color}}; font-size: {{size}}px"></view>
```

**规则：**
- 使用 `{{expression}}` 包裹表达式
- 可以在属性值的任意位置使用
- 可以多次使用

### 2.3 复合属性值

**混合静态和动态：**
```wxml
<view class="container {{activeClass}} {{sizeClass}}"></view>
<view style="width: {{width}}px; height: 100px"></view>
```

### 2.4 布尔属性

**语法：**
```wxml
<!-- 静态布尔 -->
<button disabled></button>
<checkbox checked></checkbox>

<!-- 动态布尔 -->
<button disabled="{{isDisabled}}"></button>
<checkbox checked="{{isChecked}}"></checkbox>
```

**规则：**
- 属性存在即为 true
- 属性不存在即为 false
- 动态布尔需要使用 `{{boolean}}` 表达式

### 2.5 特殊属性

**id 和 class：**
```wxml
<view id="unique-id" class="class1 class2"></view>
```

**style：**
```wxml
<view style="color: red; font-size: 14px"></view>
<view style="color: {{color}}; font-size: {{fontSize}}px"></view>
```

**data-* 自定义数据：**
```wxml
<view data-id="{{itemId}}" data-index="{{index}}"></view>
```
- 用于传递自定义数据给事件处理函数
- 在事件对象中通过 `event.currentTarget.dataset` 访问

## 3. 数据绑定

### 3.1 简单绑定

**标识符：**
```wxml
{{message}}
{{user.name}}
{{array[0]}}
```

### 3.2 运算表达式

**算术运算：**
```wxml
{{a + b}}
{{a - b}}
{{a * b}}
{{a / b}}
{{a % b}}
```

**比较运算：**
```wxml
{{a > b}}
{{a < b}}
{{a >= b}}
{{a <= b}}
{{a == b}}
{{a === b}}
{{a != b}}
{{a !== b}}
```

**逻辑运算：**
```wxml
{{a && b}}
{{a || b}}
{{!a}}
```

**三元运算：**
```wxml
{{condition ? valueTrue : valueFalse}}
```

### 3.3 字面量

**字符串：**
```wxml
{{"hello"}}
{{'world'}}
```

**数字：**
```wxml
{{123}}
{{3.14}}
```

**布尔：**
```wxml
{{true}}
{{false}}
```

**null/undefined：**
```wxml
{{null}}
{{undefined}}
```

### 3.4 数组和对象字面量

**数组：**
```wxml
<view wx:for="{{[1, 2, 3]}}">{{item}}</view>
```

**对象：**
```wxml
{{ {name: name, age: age} }}
```

模板 `data` 有独立语法，见 [6.2 使用模板](#62-使用模板)。

### 3.5 函数调用

**普通函数：**
```wxml
{{utils.formatDate(date)}}
{{tools.calculate(a, b, c)}}
```

**方法链：**
```wxml
{{user.name.trim().length}}
```

### 3.6 现代 JavaScript 表达式语法 (2026-06-27 更新)

以下现代 JavaScript 语法已确认支持：

#### Optional Chaining (可选链)

**语法：**
```wxml
{{user?.name}}
{{user?.profile?.name}}
{{obj?.[key]}}
{{fn?.()}}
```

**用途：** 安全访问可能为 null/undefined 的对象属性，避免运行时错误。

#### Nullish Coalescing (空值合并)

**语法：**
```wxml
{{value ?? 'default'}}
{{count ?? 0}}
{{user?.name ?? 'Anonymous'}}
```

**说明：** 当左侧为 `null` 或 `undefined` 时使用右侧值。与 `||` 不同，`0`、`''`、`false` 不会被视为需要替换。

#### Template Literals (模板字符串)

**语法：**
```wxml
{{`Hello ${name}`}}
{{`Total: ${count} items`}}
{{`${greeting}, you have ${count} messages`}}
```

**用途：** 更清晰的字符串拼接语法。

#### Spread 语法

**数组展开：**
```wxml
{{[...items]}}
{{[...featured, ...regular]}}
{{[...items, newItem]}}
```

**对象展开：**
```wxml
{{ {...user} }}
{{ {...base, theme: 'dark'} }}
{{ {...config, ...override} }}
```

**函数调用展开：**
```wxml
{{fn(...args)}}
{{calculate(...numbers)}}
```

**注意：** 模板 `data="{{...obj}}"` 是特殊的 template data 语法，不是普通表达式 spread。

#### Object Shorthand (对象简写)

**语法：**
```wxml
{{ {name, age, email} }}
```

**等价于：**
```wxml
{{ {name: name, age: age, email: email} }}
```

#### Computed Property Keys (计算属性键)

**语法：**
```wxml
{{ {[keyName]: value} }}
{{ {[prefix + suffix]: data} }}
```

**用途：** 动态构造对象键名。

#### typeof Operator

**语法：**
```wxml
{{typeof value}}
{{typeof error === 'string' ? error : error.message}}
```

**用途：** 类型检查，用于条件渲染。

### 3.7 不支持的表达式

以下表达式被明确禁止，会产生错误：

**逻辑定义类：**
- ❌ 箭头函数：`items.filter(x => x.active)` - 逻辑应在 JS 层
- ❌ 正则表达式：`/pattern/g` - 应在 JS 层处理
- ❌ this 表达式：`this.data.value` - 使用直接数据引用

**副作用操作：**
- ❌ 赋值：`a = 1`, `a += 1`
- ❌ 更新：`i++`, `--i`
- ❌ delete：`delete obj.prop`

**其他：**
- ❌ 数组空洞：`[,, third]` - 语义不清，使用显式 `undefined`
- ❌ void：`void expr` - 无模板用例
- ❌ new：`new Date()` - 对象创建应在 JS 层

详细说明见 [WXML-EXPRESSION-SPEC.md](./WXML-EXPRESSION-SPEC.md) 和 [COMPATIBILITY_DECISIONS.md](./COMPATIBILITY_DECISIONS.md)。

### 3.8 表达式最佳实践

1. **保持简单：** 复杂逻辑应在 JS/TS 层处理
2. **避免副作用：** 表达式应该是纯计算
3. **优先可选链：** 使用 `user?.name` 而不是 `user && user.name`
4. **合理使用 ??：** 需要区分 `0`/`''` 和 `null`/`undefined` 时使用
5. **模板字符串：** 多段字符串拼接时使用模板字符串提高可读性

## 4. 条件渲染

### 4.1 wx:if

**语法：**
```wxml
<view wx:if="{{condition}}">
  显示内容
</view>
```

**规则：**
- `wx:if` 的值是 falsy 时，元素不渲染
- falsy 值：`false`, `0`, `""`, `null`, `undefined`, `NaN`

### 4.2 wx:elif

**语法：**
```wxml
<view wx:if="{{condition1}}">
  分支 1
</view>
<view wx:elif="{{condition2}}">
  分支 2
</view>
```

**规则：**
- 必须紧跟在 `wx:if` 或另一个 `wx:elif` 之后
- 可以有多个 `wx:elif`

### 4.3 wx:else

**语法：**
```wxml
<view wx:if="{{condition}}">
  true 分支
</view>
<view wx:else>
  false 分支
</view>
```

**规则：**
- 必须紧跟在 `wx:if` 或 `wx:elif` 之后
- 不需要表达式

### 4.4 block wx:if

**语法：**
```wxml
<block wx:if="{{condition}}">
  <view>元素1</view>
  <view>元素2</view>
</block>
```

**规则：**
- `<block>` 不是真实组件，只是包装元素
- 不会在页面中渲染
- 用于包裹多个元素的条件渲染

## 5. 列表渲染

### 5.1 wx:for

**基本语法：**
```wxml
<view wx:for="{{array}}">
  {{index}}: {{item}}
</view>
```

**默认变量：**
- `item`：数组当前项
- `index`：数组当前项的索引

### 5.2 wx:for-item 和 wx:for-index

**自定义变量名：**
```wxml
<view wx:for="{{array}}" wx:for-item="element" wx:for-index="idx">
  {{idx}}: {{element}}
</view>
```

### 5.3 wx:key

**语法：**
```wxml
<!-- 使用对象属性 -->
<view wx:for="{{array}}" wx:key="id">
  {{item.name}}
</view>

<!-- 使用 *this（数组项本身） -->
<view wx:for="{{array}}" wx:key="*this">
  {{item}}
</view>
```

**规则：**
- `wx:key` 用于指定列表项的唯一标识
- 提高渲染性能，正确维护组件状态
- 可以是对象的属性名（字符串，不需要 `{{}}`）
- 可以是保留关键字 `*this`（代表数组项本身）

### 5.4 嵌套 wx:for

**语法：**
```wxml
<view wx:for="{{outer}}" wx:for-item="outerItem">
  <view wx:for="{{outerItem.inner}}" wx:for-item="innerItem">
    {{outerItem.name}} - {{innerItem.name}}
  </view>
</view>
```

### 5.5 block wx:for

**语法：**
```wxml
<block wx:for="{{array}}">
  <view>{{item.name}}</view>
  <view>{{item.age}}</view>
</block>
```

## 6. 模板

### 6.1 定义模板

**语法：**
```wxml
<template name="msgItem">
  <view>
    <text>{{index}}: {{msg}}</text>
    <text>Time: {{time}}</text>
  </view>
</template>
```

**规则：**
- 使用 `name` 属性指定模板名称
- 模板内使用的变量需要通过 `data` 传入

### 6.2 使用模板

**语法：**
```wxml
<template is="msgItem" data="{{...item}}" />
<template is="msgItem" data="{{text: 'forbar'}}" />
<template is="msgItem" data="{{item}}" />
<template is="msgItem" data="{{foo, bar}}" />
<template is="msgItem" data="{{...obj1, ...obj2, a, c: 6}}" />
<template is="msgItem" data="{{...{name: name, age: age}}}" />
```

**规则：**
- 使用 `is` 属性指定模板名称
- 使用 `data` 属性传递数据
- `data` 使用 template data grammar，不是普通 WXML value expression
- `data` 会构造传入模板的 object scope
- `data="{{text: 'forbar'}}"` 等价于传入 `{ text: 'forbar' }`
- `data="{{item}}"` 等价于传入 `{ item: item }`，不是 `{ ...item }`
- `data="{{foo, bar}}"` 等价于传入 `{ foo: foo, bar: bar }`
- `data="{{...item}}"` 等价于传入 `{ ...item }`
- `data="{{...obj1, ...obj2, a, c: 6}}"` 等价于传入
  `{ ...obj1, ...obj2, a: a, c: 6 }`
- 上述形式可以混合；如果存在同名 key，后面的值覆盖前面的值

### 6.3 动态模板名

**语法：**
```wxml
<template is="{{templateName}}" data="{{...item}}" />
```

## 7. 引用

### 7.1 import

**语法：**
```wxml
<import src="./template.wxml" />
```

**规则：**
- 导入目标文件中定义的 `<template>`
- 只导入 template 定义，不导入其他内容
- 不支持递归导入（A import B, B import C，A 无法使用 C 的模板）

### 7.2 include

**语法：**
```wxml
<include src="./header.wxml" />
```

**规则：**
- 将目标文件的内容完整复制到当前位置
- 相当于内联（inline）
- 不能包含 `<template>` 定义和 `<wxs>` 模块

## 8. 事件绑定

### 8.1 bind 事件

**语法：**
```wxml
<!-- bind: 前缀 -->
<view bind:tap="handleTap">Click</view>

<!-- bind 前缀（旧语法） -->
<view bindtap="handleTap">Click</view>
```

**规则：**
- 事件冒泡，不阻止冒泡
- 推荐使用 `bind:` 语法

### 8.2 catch 事件

**语法：**
```wxml
<!-- catch: 前缀 -->
<view catch:tap="handleTap">Click</view>

<!-- catch 前缀（旧语法） -->
<view catchtap="handleTap">Click</view>
```

**规则：**
- 阻止事件冒泡

### 8.3 capture 阶段事件

**语法：**
```wxml
<view capture-bind:tap="handleTap1">
  <view bind:tap="handleTap2">Click</view>
</view>

<view capture-catch:tap="handleTap1">
  <view bind:tap="handleTap2">Click</view>
</view>
```

**规则：**
- `capture-bind:` 在捕获阶段触发，不阻止冒泡
- `capture-catch:` 在捕获阶段触发，阻止后续事件

### 8.4 mut-bind 事件（互斥事件）

**语法：**
```wxml
<view mut-bind:tap="handleTap">Click</view>
```

**规则：**
- 一个 `mut-bind` 触发后，同一事件类型的其他 `mut-bind` 不触发
- 常用于避免重复提交

### 8.5 常见事件类型

**触摸事件：**
- `tap`：点击
- `longpress`：长按
- `touchstart`：触摸开始
- `touchmove`：触摸移动
- `touchend`：触摸结束
- `touchcancel`：触摸取消

**其他事件：**
- `input`：输入事件
- `change`：值改变事件
- `submit`：表单提交
- `scroll`：滚动事件

## 9. WXS 模块

### 9.1 定义 WXS 模块

**内联模块：**
```wxml
<wxs module="utils">
  var formatDate = function(timestamp) {
    var date = getDate(timestamp);
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  };
  
  module.exports = {
    formatDate: formatDate
  };
</wxs>
```

**外部模块：**
```wxml
<wxs src="./utils.wxs" module="utils" />
```

### 9.2 使用 WXS 模块

**在插值中使用：**
```wxml
<view>{{utils.formatDate(timestamp)}}</view>
```

**在属性中使用：**
```wxml
<view class="{{utils.getClassName(type)}}"></view>
```

### 9.3 WXS 语法特点

- 类似 JavaScript 但不完全相同
- 不能调用小程序 API
- 不能调用 Page/Component 的方法
- 性能较高（运行在渲染层）

## 10. 组件插槽

### 10.1 默认插槽

**组件定义：**
```wxml
<!-- component.wxml -->
<view class="wrapper">
  <slot></slot>
</view>
```

**组件使用：**
```wxml
<custom-component>
  <view>这是插槽内容</view>
</custom-component>
```

### 10.2 命名插槽

**组件定义：**
```wxml
<!-- component.wxml -->
<view class="wrapper">
  <slot name="header"></slot>
  <view class="content">
    <slot></slot>
  </view>
  <slot name="footer"></slot>
</view>
```

**组件使用：**
```wxml
<custom-component>
  <view slot="header">Header</view>
  <view>Default Content</view>
  <view slot="footer">Footer</view>
</custom-component>
```

## 11. 空白处理

### 11.1 元素间空白

**规则：**
- 多个连续空白字符（空格、换行、Tab）会被合并为一个空格
- 元素前后的空白会被保留

**示例：**
```wxml
<view>A</view>    <view>B</view>
<!-- 结果：<view>A</view> <view>B</view> -->
```

### 11.2 元素内空白

**规则：**
- 文本节点内的空白字符会被保留
- 行首尾空白会被保留

**示例：**
```wxml
<view>  Hello World  </view>
<!-- 结果保留所有空格 -->
```

### 11.3 插值表达式的空白

**规则：**
- `{{` 和 `}}` 内的空白会被保留并传递给表达式解析器

**示例：**
```wxml
{{ message }}
<!-- 等价于 -->
{{message}}
```

## 12. 特殊字符和转义

### 12.1 HTML 实体

**支持的实体：**
```wxml
&lt;    <!-- < -->
&gt;    <!-- > -->
&amp;   <!-- & -->
&nbsp;  <!-- 不间断空格 -->
&quot;  <!-- " -->
&apos;  <!-- ' -->
```

### 12.2 数字实体

**十进制：**
```wxml
&#65;   <!-- A -->
&#20320; <!-- 你 -->
```

**十六进制：**
```wxml
&#x41;   <!-- A -->
&#x4F60; <!-- 你 -->
```

## 13. 限制和注意事项

### 13.1 不支持的 HTML 特性

- ❌ 不支持 `<script>` 标签（使用 `<wxs>` 代替）
- ❌ 不支持 `<style>` 标签（样式在 WXSS 文件中）
- ❌ 不支持 HTML5 新标签（如 `<video>` 需要用小程序的 `<video>` 组件）
- ❌ 不支持 `innerHTML`、`outerHTML` 等 DOM 操作

### 13.2 表达式限制

- ❌ 不支持赋值表达式：`{{a = 1}}`
- ❌ 不支持 `new` 操作符：`{{new Date()}}`
- ❌ 不支持逗号运算符：`{{a, b}}`
- ❌ 不支持语句：`{{if (a) {...}}}`

### 13.3 性能注意事项

- 避免在 `wx:for` 中使用复杂表达式
- 合理使用 `wx:key` 提升列表渲染性能
- 避免过深的嵌套结构
- 大数据列表考虑虚拟列表方案

## 14. 与其他模板语言对比

### 14.1 与 Vue 对比

| 特性 | WXML | Vue |
|------|------|-----|
| 数据绑定 | `{{value}}` | `{{value}}` 或 `v-bind` |
| 条件渲染 | `wx:if` | `v-if` |
| 列表渲染 | `wx:for` | `v-for` |
| 事件绑定 | `bind:tap` | `@click` 或 `v-on:click` |
| 模板 | `<template>` | `<template>` 或 SFC |

### 14.2 与 React JSX 对比

| 特性 | WXML | React JSX |
|------|------|-----------|
| 语法类型 | 模板语法 | JavaScript 表达式 |
| 数据绑定 | `{{value}}` | `{value}` |
| 条件渲染 | `wx:if` | `{condition && <div/>}` |
| 列表渲染 | `wx:for` | `{array.map(...)}` |
| 事件绑定 | `bind:tap` | `onClick` |

## 附录 A：完整语法示例

```wxml
<!-- 完整示例：用户列表 -->
<wxs module="utils">
  var formatTime = function(timestamp) {
    return 'formatted time';
  };
  module.exports.formatTime = formatTime;
</wxs>

<view class="container">
  <!-- 条件渲染 -->
  <view wx:if="{{userList.length > 0}}">
    <!-- 列表渲染 -->
    <view 
      wx:for="{{userList}}" 
      wx:key="id"
      wx:for-item="user"
      wx:for-index="idx"
      class="user-item {{user.active ? 'active' : ''}}"
      data-id="{{user.id}}"
      bind:tap="handleUserTap"
    >
      <!-- 复合文本 -->
      <text>{{idx + 1}}. {{user.name}}</text>
      <text>{{utils.formatTime(user.createTime)}}</text>
      
      <!-- 嵌套条件 -->
      <view wx:if="{{user.vip}}">
        <text>VIP</text>
      </view>
    </view>
  </view>
  
  <!-- else 分支 -->
  <view wx:else>
    <text>暂无数据</text>
  </view>
  
  <!-- 使用模板 -->
  <template is="userCard" data="{{...selectedUser}}" />
</view>

<!-- 定义模板 -->
<template name="userCard">
  <view class="card">
    <text>{{name}}</text>
    <text>{{email}}</text>
  </view>
</template>
```

## 附录 B：待确认事项

以下内容需要通过官方文档或实际测试确认：

1. **复合属性的官方支持** - `class="a {{b}} c"` 是否在官方文档中明确说明？
2. **表达式支持的 ECMAScript 版本** - 支持到 ES5, ES6, 还是更高？
3. **箭头函数支持** - `{{array.filter(x => x > 0)}}` 是否支持？
4. **模板字面量支持** - `{{ `Hello ${name}` }}` 是否支持？
5. **解构赋值支持** - `{{...obj}}` 在哪些场景支持？
6. **wx:if + wx:for 组合** - 同一元素上可以同时使用吗？优先级？
7. **转义语法** - 如何输出字面的 `{{` 和 `}}`？
8. **CDATA 支持** - 是否支持 `<![CDATA[...]]>` 语法？
9. **条件编译** - `<!-- #ifdef -->` 是否是标准语法？
10. **动态组件名** - `<{{componentName}} />` 是否支持？

---

**下一步：** 基于此语言规范，编写《WXML 解析规范》，定义从源码到 AST 的映射关系。
