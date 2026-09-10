# 全局 usingComponents 支持

## 概述

Dimina 编译器支持在 `app.json` 中配置全局 `usingComponents`。全局组件会合并到主包和分包页面的组件配置中，不需要在每个页面重复声明。

## 功能特性

### 1. 全局组件声明

在 `app.json` 中声明的组件会自动注入到所有页面中：

```json
{
  "pages": ["pages/index/index", "pages/about/about"],
  "usingComponents": {
    "global-button": "./components/global-button/index",
    "global-header": "./components/global-header/index",
    "vant-button": "vant-weapp/button"
  }
}
```

### 2. 页面级覆盖

页面级的 `usingComponents` 配置具有更高的优先级，可以覆盖全局组件：

```json
// pages/about/about.json
{
  "usingComponents": {
    "global-button": "./components/page-button/index"
  }
}
```

### 3. 分包支持

分包中的页面也会继承全局组件配置：

```json
{
  "pages": ["pages/index/index"],
  "subPackages": [{
    "root": "packageA",
    "pages": ["pages/detail/detail"]
  }],
  "usingComponents": {
    "global-button": "./components/global-button/index"
  }
}
```

### 4. npm 组件支持

支持在全局配置中使用 npm 组件：

```json
{
  "usingComponents": {
    "vant-button": "vant-weapp/button",
    "vant-cell": "vant-weapp/cell"
  }
}
```

## 实现原理

### 1. 配置收集阶段

在 `storePageConfig()` 函数中，编译器会首先处理 `app.json` 中的全局 `usingComponents`：

```javascript
// 首先处理 app.json 中的全局 usingComponents
if (configInfo.appInfo.usingComponents) {
    const appFilePath = `${pathInfo.workPath}/app.json`
    storeComponentConfig(configInfo.appInfo, appFilePath)
}
```

### 2. 页面配置合并

在 `getPages()` 函数中，全局组件配置会与页面级配置合并：

```javascript
const { pages, subPackages = [], usingComponents: globalComponents = {} } = getAppConfigInfo()

const mainPages = pages.map(path => {
    const pageComponents = pageInfo[path]?.usingComponents || {}
    // 合并全局组件和页面组件，页面组件优先级更高
    const mergedComponents = { ...globalComponents, ...pageComponents }
    
    return {
        id: uuid(),
        path,
        usingComponents: mergedComponents,
    }
})
```

### 3. 编译阶段

编译阶段会根据合并后的 `usingComponents` 收集并编译组件依赖。

## 使用示例

### 基本用法

```json
// app.json
{
  "pages": ["pages/index/index"],
  "usingComponents": {
    "my-button": "./components/my-button/index"
  }
}
```

```xml
<!-- pages/index/index.wxml -->
<view>
  <!-- 直接使用全局组件，无需在页面配置中声明 -->
  <my-button>点击我</my-button>
</view>
```

### 页面级覆盖

```json
// pages/special/special.json
{
  "usingComponents": {
    "my-button": "./components/special-button/index"
  }
}
```

```xml
<!-- pages/special/special.wxml -->
<view>
  <!-- 这里使用的是页面级的 special-button 组件 -->
  <my-button>特殊按钮</my-button>
</view>
```

## 测试覆盖

现有测试覆盖以下场景：

1. 全局组件注入主包页面
2. 页面级配置覆盖全局配置
3. 分包页面继承全局配置
4. 全局配置引用 npm 组件

## 兼容性边界

合并优先级和主包、分包继承规则按微信小程序的常见用法实现。本文只说明当前编译器已验证的范围，不代表覆盖 `usingComponents` 的所有平台细节。

## 注意事项

1. **优先级**：页面级 `usingComponents` 优先级高于全局配置
2. **依赖范围**：所有页面都会继承全局声明，只应放置确实需要全局使用的组件
3. **依赖管理**：编译器会自动处理组件间的依赖关系
4. **路径解析**：支持相对路径和 npm 包路径

## 相关链接

- [微信小程序官方文档 - 全局配置](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#usingComponents)
- [Dimina 编译器文档](../README.md)
- [相关测试用例](../__tests__/global-usingComponents.spec.js)
