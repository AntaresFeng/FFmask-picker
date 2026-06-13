### 1. 产品概述
*   **产品名称**：FFmask Web Picker
*   **产品形态**：纯前端单页应用 (SPA)。可打包为单一的 `index.html` 文件（内联 CSS/JS），无需后端服务器，本地双击即可在浏览器中运行。
*   **核心目标**：利用浏览器原生的视频播放与 Canvas 绘图能力，可视化拾取视频遮罩坐标，并生成 FFmpeg 参数。
*   **技术选型**：HTML5 + CSS3 + 原生 JavaScript (Vanilla JS)。**零第三方依赖**（不使用 React/Vue 等重型框架，确保单文件体积在 50KB 以内）。

### 2. 核心功能清单

| 优先级 | 功能模块 | 前端技术实现方案 | 验收标准 |
| :--- | :--- | :--- | :--- |
| P0 | 视频载入 | HTML5 Drag & Drop API + `<input type="file">` | 支持拖拽视频文件到网页；支持点击按钮选择本地视频。 |
| P0 | 视频预览 | HTML5 `<video>` 标签 | 自动播放/暂停控制；视频等比缩放适应容器；支持主流格式 (MP4/WebM)。 |
| P0 | 遮罩绘制 | HTML5 `<canvas>` 覆盖层 + 鼠标事件监听 | 鼠标左键拖拽绘制矩形；实时渲染半透明黑色遮罩；支持重绘覆盖。 |
| P0 | 参数生成 | JavaScript 实时计算 | 根据 Canvas 交互实时计算原始视频坐标，并拼接 FFmpeg 字符串。 |
| P0 | 一键复制 | Clipboard API (`navigator.clipboard.writeText`) | 点击复制按钮，将参数写入系统剪贴板，并给出 Toast 提示。 |
| P1 | 进度控制 | `<video>` 原生控件或自定义 `<input type="range">` | 拖动进度条精准定位到需要打码的视频帧。 |
| P2 | 快捷键支持 | `window.addEventListener('keydown')` | 空格(播放/暂停)，Esc(清除遮罩)，方向键(微调)。 |

### 3. 交互与 UI 规范

#### 3.1 界面布局 (响应式极简风)
采用 Flexbox 布局，深色主题（减少视觉干扰，突出视频内容）。

```text
┌─────────────────────────────────────────────┐
│  📁 拖拽视频文件到此处，或 [点击选择文件]    │ <- 顶部操作区 (支持 DnD 高亮)
├─────────────────────────────────────────────┤
│                                             │
│    ┌───────────────────────────────────┐    │
│    │                                   │    │
│    │      <video> 与 <canvas> 叠层     │    │ <- 核心预览区 (居中，保持宽高比)
│    │                                   │    │
│    └───────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│ 原始坐标: x:120 y:340 w:200 h:150           │ <- 底部数据区
│ FFmpeg: -vf "drawbox=x... [📋 复制命令]    │
└─────────────────────────────────────────────┘
```

#### 3.2 关键交互细节
*   **文件读取机制**：获取到本地 `File` 对象后，使用 `URL.createObjectURL(file)` 生成临时本地 URL 赋值给 `<video>` 的 `src`。这避免了文件上传，完全在本地浏览器内存中处理，保护隐私且速度极快。
*   **Canvas 叠层**：将 `<canvas>` 使用 CSS `position: absolute` 覆盖在 `<video>` 上方，设置 `pointer-events: auto` 拦截鼠标事件，视频本身设置 `pointer-events: none`。
*   **绘制反馈**：拖动时，Canvas 绘制青色边框和半透明黑色填充 (`rgba(0,0,0,0.5)`)；松开鼠标后，保持遮罩显示。

### 4. 输出参数格式规范

**① 纯坐标值**（方便填入已有脚本）：
```
120 340 200 150
```

**② 仅滤镜参数 **（方便串联多个滤镜）：
```bash
x=120:y=340:w=200:h=150:color=black:t=fill
```

**③ 完整 FFmpeg 滤镜链**（直接可用）：
```bash
-vf "drawbox=x=120:y=340:w=200:h=150:color=black:t=fill"
```

### 5. 技术实现要点 & 避坑指南 (前端特有)

| 风险点 / 坑点 | 前端解决方案 |
| :--- | :--- |
| **坐标系换算 (核心难点)** | 鼠标在 Canvas 上的坐标 (`e.offsetX`, `e.offsetY`) 是**渲染坐标**。必须通过公式换算为**原始视频坐标**：<br>`realX = e.offsetX * (video.videoWidth / video.clientWidth)`<br>`realY = e.offsetY * (video.videoHeight / video.clientHeight)`。 |
| **视频格式兼容性** | 浏览器 `<video>` 标签对 H.265 (HEVC) 或老旧 AVI 格式支持较差。**对策**：在 UI 提示中明确建议用户输入 MP4 (H.264) 或 WebM 格式；若视频无法播放，给出友好的错误提示。 |
| **Canvas 模糊问题 (高分屏)** | 在 Retina/高分屏下，Canvas 绘制会模糊。**对策**：在初始化 Canvas 时，读取 `window.devicePixelRatio`，将 Canvas 的物理宽高放大相应倍数，并通过 CSS 缩放回原尺寸，最后 `ctx.scale(ratio, ratio)`。 |
| **内存泄漏** | 每次重新拖入新视频时，必须调用 `URL.revokeObjectURL(oldUrl)` 释放上一个视频的临时 URL，防止浏览器内存溢出。 |
| **跨域/本地运行限制** | 纯前端单文件在 `file://` 协议下运行，某些浏览器可能限制 Clipboard API。**对策**：提供备用的 `document.execCommand('copy')` (旧版 API) 或提供一个只读 `<input>` 框让用户手动 Ctrl+C。 |

### 6. MVP 开发路径建议

1.  **Step 1 (HTML/CSS 骨架)**：搭建拖拽区域、`<video>` 标签、`<canvas>` 叠层以及底部的参数展示区。完成基础样式和 Flex 布局。
2.  **Step 2 (文件与视频加载)**：实现 Drag & Drop 和 File Input 逻辑，使用 `createObjectURL` 让视频在 `<video>` 标签中成功播放。
3.  **Step 3 (Canvas 绘图与换算)**：监听 Canvas 的 `mousedown/move/up` 事件，实现矩形绘制，并**重点攻克**渲染坐标到原始视频坐标的换算逻辑。
4.  **Step 4 (参数生成与复制)**：将换算后的真实坐标填入底部 UI，拼接 FFmpeg 字符串，并接入 Clipboard API 实现一键复制。
5.  **Step 5 (打包与优化)**：将 CSS 和 JS 内联到 HTML 中，压缩代码，测试在 Chrome/Edge/Safari 下的兼容性，输出最终的 `index.html`。
