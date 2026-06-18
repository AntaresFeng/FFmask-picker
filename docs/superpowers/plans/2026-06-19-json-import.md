# JSON 导入功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工具栏添加"导入"按钮，支持从 JSON 配置文件导入矩形数据

**Architecture:** 在 export.ts 新增 `importJson()` 解析函数，state.ts 新增 `setRectangles()` 替换矩形数组，toolbar.ts 新增 `setupImport()` 处理文件选择和导入逻辑，index.html 添加按钮和隐藏的文件输入元素

**Tech Stack:** Vanilla TypeScript, Vite

---

## 文件变更清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `index.html:87` | 修改 | 在 `#btn-drawer-toggle` 前添加导入按钮和隐藏文件输入 |
| `src/state.ts:134` | 修改 | 新增 `setRectangles()` 函数 |
| `src/export.ts:63` | 修改 | 新增 `importJson()` 解析函数 |
| `src/toolbar.ts:17` | 修改 | 新增 `setupImport()` 并在 `initToolbar()` 中调用 |

---

### Task 1: 添加 UI 元素

**Files:**
- Modify: `index.html:87`

- [ ] **Step 1: 在 toolbar 中添加导入按钮**

在 `#btn-drawer-toggle` 之前插入按钮和隐藏的文件输入：

```html
<button id="btn-import" title="导入 JSON 配置">导入</button>
<input type="file" id="import-input" accept=".json" style="display:none" />
```

完整上下文（index.html 第 86-88 行区域）：

```html
        </div>
        <button id="btn-import" title="导入 JSON 配置">导入</button>
        <input type="file" id="import-input" accept=".json" style="display:none" />
        <button id="btn-drawer-toggle" title="展开/折叠面板">☰</button>
```

- [ ] **Step 2: 验证类型检查**

```bash
pnpm typecheck
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "feat(ui): add import button to toolbar"
```

---

### Task 2: 添加 state.ts 的 setRectangles 函数

**Files:**
- Modify: `src/state.ts:134`（在 `getSelectedRect()` 之后）

- [ ] **Step 1: 添加 setRectangles 函数**

在 `src/state.ts` 的 `getSelectedRect()` 函数之后添加：

```typescript
/** Replace all rectangles and clear selection. Pushes history. */
export function setRectangles(rects: Rectangle[]): void {
  historyState = { rectangles: rects, selectedId: null }
  pushHistory()
}
```

- [ ] **Step 2: 验证类型检查**

```bash
pnpm typecheck
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/state.ts
git commit -m "feat(state): add setRectangles for JSON import"
```

---

### Task 3: 添加 export.ts 的 importJson 函数

**Files:**
- Modify: `src/export.ts:63`（文件末尾）

- [ ] **Step 1: 添加 importJson 函数**

在 `src/export.ts` 末尾添加：

```typescript
/**
 * Parse JSON text and return validated rectangles.
 * Returns only valid rects; records errors for invalid items.
 */
export function importJson(text: string): { rects: Rectangle[]; errors: string[] } {
  const errors: string[] = []
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    return { rects: [], errors: ['JSON 解析失败'] }
  }

  if (!Array.isArray(data)) {
    return { rects: [], errors: ['JSON 根元素必须是数组'] }
  }

  const rects: Rectangle[] = []

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    const prefix = `矩形 ${i + 1}`

    if (typeof item !== 'object' || item === null) {
      errors.push(`${prefix}：不是对象`)
      continue
    }

    const { x, y, width, height } = item as Record<string, unknown>

    if (!isFiniteNum(x) || !isFiniteNum(y) || !isFiniteNum(width) || !isFiniteNum(height)) {
      errors.push(`${prefix}：x/y/width/height 必须为数字`)
      continue
    }

    const rect: Rectangle = {
      id: `imported-${i}`,
      x: x as number,
      y: y as number,
      width: width as number,
      height: height as number,
      color: typeof (item as any).color === 'string' ? (item as any).color : 'red',
      thickness: isFiniteNum((item as any).thickness) ? (item as any).thickness : 4,
      filled: typeof (item as any).filled === 'boolean' ? (item as any).filled : false,
      opacity: isFiniteNum((item as any).opacity) ? (item as any).opacity : 1,
      visible: typeof (item as any).visible === 'boolean' ? (item as any).visible : true,
    }

    const tr = (item as any).timeRange
    if (tr !== null && tr !== undefined) {
      if (isFiniteNum(tr?.start) && isFiniteNum(tr?.end)) {
        rect.timeRange = { start: tr.start, end: tr.end }
      }
    }

    rects.push(rect)
  }

  return { rects, errors }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
```

- [ ] **Step 2: 验证类型检查**

```bash
pnpm typecheck
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/export.ts
git commit -m "feat(export): add importJson parser"
```

---

### Task 4: 添加 toolbar.ts 的 setupImport 函数

**Files:**
- Modify: `src/toolbar.ts:8`（import 行）
- Modify: `src/toolbar.ts:17`（initToolbar 函数体）

- [ ] **Step 1: 更新 import 行**

在 `src/toolbar.ts` 第 1 行的 import 中添加 `setRectangles`：

```typescript
import { getState, setGlobalState, selectRectangle, subscribe, pushHistory, undo, redo, canUndo, canRedo, setRectangles } from './state'
```

添加 `importJson` 导入：

```typescript
import { importJson } from './export'
```

- [ ] **Step 2: 在 initToolbar 中调用 setupImport**

在 `initToolbar()` 函数体中添加 `setupImport()` 调用：

```typescript
export function initToolbar(): void {
  setupUpload()
  setupPlayback()
  setupModeButtons()
  setupColorDropdown()
  setupSpeedControl()
  setupUndoRedo()
  setupResetButton()
  setupImport()

  subscribe(updateToolbarState)
  updateToolbarState(getState())
}
```

- [ ] **Step 3: 添加 setupImport 函数**

在 `setupResetButton()` 函数之后添加：

```typescript
function setupImport(): void {
  const btn = document.getElementById('btn-import')!
  const fileInput = document.getElementById('import-input') as HTMLInputElement

  btn.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const { rects, errors } = importJson(text)

      if (rects.length > 0) {
        setRectangles(rects)
        const msg = `已导入 ${rects.length} 个矩形`
        showToast(errors.length > 0 ? `${msg}（跳过 ${errors.length} 个无效项）` : msg)
      } else if (errors.length > 0) {
        showToast(`导入失败：${errors[0]}`)
      } else {
        setRectangles([])
        showToast('已导入 0 个矩形（配置为空）')
      }
    }
    reader.readAsText(file)

    // Reset so re-importing the same file triggers change
    fileInput.value = ''
  })
}
```

- [ ] **Step 4: 验证类型检查**

```bash
pnpm typecheck
```

Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/toolbar.ts
git commit -m "feat(toolbar): wire up JSON import"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: 启动开发服务器验证**

```bash
pnpm dev
```

手动测试：
1. 上传一个视频
2. 点击"导入"按钮
3. 选择 `ffmask-config.json` 文件
4. 验证 toast 显示 "已导入 2 个矩形"
5. 验证侧边栏显示两个矩形
6. 验证 Ctrl+Z 可撤销导入

- [ ] **Step 2: 构建验证**

```bash
pnpm build
```

Expected: 构建成功，无错误

- [ ] **Step 3: 最终提交（如有修复）**

```bash
git add -A
git commit -m "fix: address review feedback for JSON import"
```
