# JSON 导入功能设计

## 概述

在工具栏添加"导入"按钮，支持从 JSON 配置文件导入矩形数据。按钮位于展开/折叠按钮左侧，样式与"上传"按钮一致。

## JSON 格式

与现有 `exportJson()` 导出格式完全一致——矩形对象数组，每个对象包含：

| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| x | number | 是 | - |
| y | number | 是 | - |
| width | number | 是 | - |
| height | number | 是 | - |
| color | string | 否 | `'red'` |
| thickness | number | 否 | `4` |
| filled | boolean | 否 | `false` |
| opacity | number | 否 | `1` |
| visible | boolean | 否 | `true` |
| timeRange | `{start, end}` 或 `null` | 否 | `undefined` |

## UI 变更

### index.html

在 `#btn-drawer-toggle` 之前添加：

```html
<button id="btn-import" title="导入 JSON 配置">导入</button>
<input type="file" id="import-input" accept=".json" style="display:none" />
```

无需额外 CSS——复用现有 `button` 样式，与"上传"按钮外观一致。

## 逻辑变更

### state.ts

新增 `setRectangles(rects: Rectangle[])` 函数：

- 替换当前 `historyState.rectangles`
- 清除 `selectedId`
- 调用 `pushHistory()`（支持撤销）

### export.ts

新增 `importJson(text: string): { rects: Rectangle[], errors: string[] }` 函数：

1. `JSON.parse(text)`，失败则返回错误
2. 验证结果必须为数组
3. 逐项处理：
   - `x`, `y`, `width`, `height` 必须为有限数字，否则跳过并记录错误
   - 可选字段缺失时使用默认值
   - `timeRange` 非 `null` 且缺少 `start`/`end` 时忽略该字段
4. 为每个矩形通过 `createRectangle()` 模式分配 `id`
5. 返回解析结果和错误列表

### toolbar.ts

新增 `setupImport()` 函数：

- 点击 `#btn-import` 触发 `#import-input` 的 click
- `#import-input` 的 change 事件：
  - 读取文件内容（`FileReader.readAsText`）
  - 调用 `importJson(text)`
  - 若有有效矩形：调用 `setRectangles(rects)`，toast "已导入 N 个矩形"
  - 若有错误：toast 显示前几条错误信息
  - 若无有效矩形且有错误：toast "导入失败：无有效矩形"
  - 重置 file input 的 value（允许重复导入同一文件）

## 边界情况

- 空数组 `[]` → 合法，清空所有矩形
- JSON 语法错误 → toast 报错，不改变状态
- 部分矩形字段无效 → 跳过无效项，导入其余，toast 提示跳过了几项
- 导入操作本身可撤销（Ctrl+Z 恢复导入前的状态）

## 不做的事

- 不替换视频——导入仅影响矩形数据
- 不做合并模式——导入即替换，简洁明了
- 不弹确认对话框——有撤销兜底
