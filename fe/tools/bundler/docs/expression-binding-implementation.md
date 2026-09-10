# 组件属性表达式绑定

本文说明组件属性表达式如何在编译阶段记录依赖，并在父组件调用 `setData()` 后同步到子组件。

## 处理流程

以以下模板为例：

```xml
<child-comp count2="{{count || defaultValue}}" />
```

处理过程分为三步：

1. Compiler 使用 Oxc 解析表达式，生成表达式文本、根依赖和简单绑定标记。
2. Render 将绑定信息随组件实例注册消息发送给 Service。
3. 父组件数据变化后，Service 检查受影响的依赖，重新求值并更新子组件 property。

生成的绑定信息如下：

```json
{
  "count2": {
    "expression": "count || defaultValue",
    "dependencies": ["count", "defaultValue"],
    "isSimple": false
  }
}
```

## 编译阶段

`packages/compiler/src/common/expression-parser.js` 使用 `oxc-parser` 分析表达式。成员访问只记录根对象，例如 `item.name` 记录为 `item`；对象字面量的静态键、JavaScript 关键字和已知全局对象不会被当作数据依赖。

```js
parseExpression('count')
// { expression: 'count', dependencies: ['count'], isSimple: true }

parseExpression('item.name')
// { expression: 'item.name', dependencies: ['item'], isSimple: false }

parseExpression('count || defaultValue')
// {
//   expression: 'count || defaultValue',
//   dependencies: ['count', 'defaultValue'],
//   isSimple: false
// }
```

解析失败时，编译器会输出警告并返回空依赖数组。此时后续 `setData()` 无法根据依赖命中该表达式，因此应先修正模板表达式，而不是依赖运行时兜底。

`packages/compiler/src/core/view-compiler.js` 调用 `parseBindings()`，把结果写入组件属性绑定指令。Render 在组件挂载时读取这些信息，再交给 Service 保存到父实例的 `__childPropsBindings__`。

## 运行阶段

相关实现位于 `packages/service/src/core/utils.js`。

### 判断依赖变化

`hasDependencyChanged()` 会检查根依赖和本次 `setData()` 的路径。以下两种情况都会命中 `item`：

```js
setData({ item: nextItem })
setData({ 'item.name': nextName })
```

路径检查同时支持点号和方括号形式。

### 重新计算表达式

简单绑定直接通过路径读取值：

```js
if (bindingInfo.isSimple) {
  return get(parentData, bindingInfo.expression)
}
```

其他表达式使用 `new Function()` 和 `with(data)` 在父组件数据作用域内求值。求值失败时返回 `undefined` 并记录警告。

这段求值逻辑不是安全沙箱。表达式来自编译后的小程序模板，不应把外部输入或运行时下载的未受信代码直接写入 `expression` 字段。

### 更新子组件

`syncUpdateChildrenProps()` 只处理当前父实例的直接子组件。依赖命中后，计算结果会先深拷贝，再经过 property 归一化和 `tO()` 更新，从而触发对应的 observer。

```text
父组件 setData
  -> 检查 __childPropsBindings__
  -> 重新计算命中的表达式
  -> 深拷贝结果
  -> 更新子组件 property
  -> 执行 observer
```

## 当前支持的表达式

| 类型 | 示例 | 记录的依赖 |
| --- | --- | --- |
| 简单变量 | `count` | `count` |
| 成员访问 | `item.name` | `item` |
| 逻辑运算 | `count || defaultValue` | `count`、`defaultValue` |
| 算术运算 | `count + 1` | `count` |
| 三元表达式 | `active ? 'on' : 'off'` | `active` |
| 函数调用 | `formatDate(timestamp)` | `formatDate`、`timestamp` |
| 数组访问 | `list[0]` | `list` |

成员访问只跟踪根对象。`item.name` 和 `item.profile.avatar` 都记录为 `item`，具体子路径由运行时的前缀检查处理。

## 示例

```xml
<checkbox value="{{checkbox1}}" />
<image src="{{checkbox3 ? activeIcon : inactiveIcon}}" />
<checkbox value="{{checked || false}}" />
```

当父组件执行 `setData({ checkbox1: true })` 时，运行时命中 `checkbox1` 依赖，通过简单绑定路径读取 `true`，再更新子组件的 `value` property。

## 验证入口

- [依赖提取与表达式分类](../__tests__/expression-parser.test.js)
- [编译产物中的绑定信息](../__tests__/view-compiler.spec.js)
- [子组件 property 同步](../../service/__tests__/utils.spec.js)
