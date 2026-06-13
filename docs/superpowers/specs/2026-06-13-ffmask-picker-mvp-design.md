# FFmask Picker MVP 设计文档

## 概述

FFmask Picker 是一个基于浏览器的工具，用于在视频帧上绘制矩形区域并生成 FFmpeg drawbox 滤镜参数。MVP 聚焦核心流程：上传视频 → 浏览帧 → 绘制矩形 → 导出参数。

## 技术栈

- 原生 TypeScript + DOM（无框架）
- Vite 构建，vite-plugin-singlefile 打包为单个 HTML 文件
- 产物：`dist/ffmask-picker.html`

## 整体布局

沉浸式布局：

- **Canvas 工作区**：占满全屏，显示视频帧和矩形
- **顶部工具栏**：视频上传、帧导航、模式切换、颜色选择、操作按钮
- **右侧抽屉面板**：可折叠，包含矩形列表、属性编辑、导出按钮

**初始状态**：页面加载后显示上传区域（支持拖拽和点击上传），上传后进入工作模式。上传支持常见视频格式（mp4、webm、ogg 等浏览器原生支持的格式）。

## 顶部工具栏

从左到右分组：

| 分组 | 内容 |
|------|------|
| 视频 | 上传按钮 |
| 帧导航 | ▶⏸ 播放暂停（视频解码播放）/ 可切换显示（帧数 `123/500` ↔ 时间码 `00:13/2:02`）/ 自适应宽度滑条 |
| 模式 | 绘制 / 选择 切换 |
| 颜色 | 红 / 蓝 / 绿 三色选择 |
| 操作 | 撤销 / 重做 / 导出下拉菜单 / 抽屉开关 |

- 播放暂停使用 `<video>` 元素进行视频解码播放
- 滑条随播放进度实时更新，用户可拖拽跳转到任意位置
- 帧数/时间码显示区域点击可切换显示模式
- FPS 从视频元数据获取（通过 `requestVideoFrameCallback` 或手动计算），用于帧数显示和时间码转换

## Canvas 工作区

### 视频帧显示

- 默认视频帧撑满工作区
- 使用隐藏的 `<video>` 元素解码，Canvas 从 video 绘制当前帧

### 缩放与平移

- **滚轮**：缩放画布
- **中键拖拽**：平移查看区域
- **角落 minimap**：显示当前可视区域在整个视频帧中的位置和比例

### 矩形交互（取决于当前模式）

**绘制模式**：
- 左键拖拽绘制矩形（从一角到对角）

**选择模式**：
- 左键点击已有矩形 → 选中
- 拖拽选中矩形的边/角控制点 → 调整大小
- 拖拽选中矩形内部（非控制点）→ 移动

### 矩形视觉表现

- **未选中**：纯边框描边，无填充，颜色为矩形设定色
- **选中**：8个白色控制点（四角 + 四边中点）+ 微透明同色填充（~8%）+ 其他矩形变暗（~50%）
- **绘制中**：虚线边框，实时显示尺寸
- **控制点光标**：角点 nwse-resize / ne-resize 等，边中点 ns-resize / ew-resize

## 右侧抽屉面板

可折叠，展开宽度约 240px。从上到下三个区域：

### 矩形列表

- 每行：颜色块 + 名称 + 时间范围摘要 + 可见性开关（👁）
- 点击选中，高亮当前选中矩形
- 底部"+ 添加矩形"按钮

### 属性面板（选中矩形时显示）

- X / Y / 宽 / 高 输入框
- 颜色选择（红/蓝/绿）
- 粗细输入框
- 时间范围：默认隐藏，勾选"时间范围"复选框后展开开始/结束时间码输入（`HH:MM:SS:FF` 格式）

### 导出区域

底部三个按钮：
- 复制当前矩形参数
- 复制全部矩形参数
- 导出 JSON 配置文件

### 折叠行为

- 点击 ✕ 或工具栏 ☰ 折叠/展开
- 折叠后仅显示窄条，可通过工具栏按钮展开

## 导出格式

严格遵循 FFmpeg drawbox 滤镜语法（参考 ffmpeg-filters.html §11.72）。

### drawbox 参数映射

| 矩形属性 | drawbox 参数 |
|----------|-------------|
| x | `x=` |
| y | `y=` |
| width | `w=` |
| height | `h=` |
| color | `color=` / `c=` |
| thickness | `t=` |

### 时间范围

drawbox 支持 `enable` 时间线编辑。时间范围使用 `enable='between(t,start,end)'` 语法，其中 `t` 为秒数。

导出时需将 `HH:MM:SS:FF` 时间码转换为秒数（基于视频 FPS 计算）。

### 三种导出选项

**1. 复制当前矩形参数**

无时间范围：
```
drawbox=x=120:y=80:w=200:h=150:color=red:t=4
```

有时间范围：
```
drawbox=x=120:y=80:w=200:h=150:color=red:t=4:enable='between(t,5,90)'
```

**2. 复制全部矩形参数**

多个 drawbox 用逗号分隔：
```
drawbox=x=120:y=80:w=200:h=150:color=red:t=4,drawbox=x=300:y=200:w=100:h=100:color=blue:t=2:enable='between(t,10,60)'
```

**3. 导出 JSON 配置文件**

包含所有矩形配置的 JSON 文件。

### 完整命令示例

```
ffmpeg -i input.mp4 -vf "drawbox=x=120:y=80:w=200:h=150:color=red:t=4,drawbox=x=300:y=200:w=100:h=100:color=blue:t=2:enable='between(t,10,60)'" output.mp4
```

### 引号与转义

- `-vf` 参数用双引号包裹时，内部 `enable='...'` 的单引号不受影响
- 多个 drawbox 用逗号分隔，不需要额外转义
- Shell 环境下需注意外层引号的转义（工具只生成 filter 字符串，用户自行处理 shell 转义）

## 数据模型

```typescript
interface Rectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: 'red' | 'blue' | 'green'
  thickness: number
  visible: boolean
  timeRange?: {
    start: number  // 秒
    end: number    // 秒
  }
}

interface AppState {
  videoSrc: string | null  // Object URL (URL.createObjectURL)
  fps: number              // 从视频元数据获取
  duration: number         // 秒
  currentTime: number      // 秒
  rectangles: Rectangle[]
  selectedId: string | null
  mode: 'draw' | 'select'
  currentColor: 'red' | 'blue' | 'green'
  zoom: number
  panX: number
  panY: number
}
```

### 撤销/重做

通过状态快照栈实现：每次操作保存一份 AppState 快照，撤销/重做在快照栈中移动。

## 文件结构

```
src/
├── main.ts              # 入口，初始化 app
├── style.css            # 全局样式
├── state.ts             # AppState 管理 + 撤销/重做
├── canvas.ts            # Canvas 渲染（帧绘制 + 矩形绘制 + minimap）
├── interaction.ts       # 鼠标/滚轮事件处理（绘制、选择、缩放、平移）
├── toolbar.ts           # 顶部工具栏组件
├── drawer.ts            # 右侧抽屉面板组件（列表 + 属性 + 导出）
├── export.ts            # FFmpeg drawbox 参数生成 + 复制/导出
├── timecode.ts          # 时间码转换工具（秒 ↔ HH:MM:SS:FF）
└── vite-env.d.ts        # Vite 类型声明
```

每个文件职责单一，通过共享 AppState 通信。Canvas 使用 requestAnimationFrame 循环渲染。
