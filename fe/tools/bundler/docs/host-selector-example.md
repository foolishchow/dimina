# :host 选择器使用指南

## 概述

`:host` 选择器用于选择自定义组件的根节点。根据[微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/wxml-wxss.html)，组件对应的 WXSS 文件中的样式，只对组件 WXML 内的节点生效。

## 支持的 :host 选择器模式

### 1. 基本用法

```css
/* 选择组件根节点 */
:host {
  display: block;
  background-color: #f5f5f5;
}
```

编译器先把 `:host` 改写为组件宿主标记（以下用 `component-id` 代表示例组件的作用域 ID）：

```css
[data-dd-style-host~="component-id"] {
  display: block;
  background-color: #f5f5f5;
}
```

### 2. 带条件的根节点选择

```css
/* 当组件根节点有 .active 类时 */
:host(.active) {
  border: 2px solid blue;
}

/* 当组件根节点有 .theme-dark 类时 */
:host(.theme-dark) {
  background-color: #333;
  color: white;
}
```

编译后：

```css
[data-dd-style-host~="component-id"].active {
  border: 2px solid blue;
}

[data-dd-style-host~="component-id"].theme-dark {
  background-color: #333;
  color: white;
}
```

### 3. 复合选择器

```css
/* 组件根节点的伪类状态 */
:host:hover {
  opacity: 0.8;
}

/* 组件根节点同时具有类名 */
:host.highlighted {
  box-shadow: 0 0 10px rgba(0, 0, 255, 0.3);
}
```

编译后：

```css
[data-dd-style-host~="component-id"]:hover {
  opacity: 0.8;
}

[data-dd-style-host~="component-id"].highlighted {
  box-shadow: 0 0 10px rgba(0, 0, 255, 0.3);
}
```

### 4. 后代选择器

```css
/* 组件根节点内的子元素 */
:host .content {
  padding: 20px;
}

/* 带条件的组件根节点内的子元素 */
:host(.compact) .content {
  padding: 10px;
}
```

编译后：

```css
[data-dd-style-host~="component-id"] .content {
  padding: 20px;
}

[data-dd-style-host~="component-id"].compact .content {
  padding: 10px;
}
```

### 5. 复杂选择器组合

```css
/* 复杂的选择器组合 */
:host(.theme-dark) .header > .title:first-child {
  color: #fff;
  font-weight: bold;
}

/* 多个选择器 */
:host .item,
:host(.active) .selected-item {
  transition: all 0.3s ease;
}
```

编译后：

```css
[data-dd-style-host~="component-id"].theme-dark .header > .title:first-child {
  color: #fff;
  font-weight: bold;
}

[data-dd-style-host~="component-id"] .item,
[data-dd-style-host~="component-id"].active .selected-item {
  transition: all 0.3s ease;
}
```

## 实际使用示例

### 组件样式文件 (my-component.wxss)

```css
/* 组件根节点基础样式 */
:host {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 不同主题的根节点样式 */
:host(.theme-dark) {
  background-color: #2d2d2d;
  color: #fff;
}

:host(.theme-primary) {
  background-color: #007aff;
  color: #fff;
}

/* 根节点状态样式 */
:host(.disabled) {
  opacity: 0.5;
  pointer-events: none;
}

/* 根节点内的子元素样式 */
:host .header {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

:host(.theme-dark) .header {
  border-bottom-color: #444;
}

:host .content {
  padding: 16px;
  flex: 1;
}

:host .footer {
  padding: 12px 16px;
  background-color: #f8f8f8;
}

:host(.theme-dark) .footer {
  background-color: #1a1a1a;
}
```

### 组件模板文件 (my-component.wxml)

```xml
<view class="header">
  <text class="title">{{title}}</text>
</view>
<view class="content">
  <slot></slot>
</view>
<view class="footer">
  <text class="info">{{info}}</text>
</view>
```

### 使用组件

```xml
<!-- 基础使用 -->
<my-component title="标题" info="信息">
  <text>内容</text>
</my-component>

<!-- 带主题的使用 -->
<my-component class="theme-dark" title="深色主题" info="信息">
  <text>内容</text>
</my-component>

<!-- 禁用状态 -->
<my-component class="disabled" title="禁用状态" info="信息">
  <text>内容</text>
</my-component>
```

## 注意事项

1. `:host` 选择器只在自定义组件的样式文件中生效
2. 编译器使用 `[data-dd-style-host~="<scope-id>"]` 标记组件宿主；普通后代样式仍由组件作用域规则处理
3. 当前已覆盖 `:host`、`:host(...)`、类名、伪类、后代选择器和选择器列表，具体范围见[回归测试](../__tests__/host-selector.test.js)
4. 遇到尚未覆盖的复杂组合选择器时，应以编译产物和目标端实测结果为准
