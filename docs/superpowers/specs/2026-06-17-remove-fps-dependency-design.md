# Remove FPS Dependency — Time-Only Design

## Problem

FPS detection in browsers is unreliable (hardcoded to 30). The frame-based features (frame slider, frame display, frame mode timeRange) all depend on an inaccurate fps value, causing:

- Slider position drift vs actual video time
- Frame count display is wrong
- Frame↔time conversion errors in timeRange mode toggle

## Goal

Remove all frame-based concepts. Everything becomes time-based (seconds). The slider uses milliseconds for integer precision.

## Changes

### 1. `types.ts` — Data model

Remove `fps` from `GlobalState`. Simplify `timeRange` to always store seconds:

```ts
// Before
export interface GlobalState {
  fps: number
  // ...
}
export interface Rectangle {
  timeRange?: {
    start: number
    end: number
    mode: 'time' | 'frame'
  }
}

// After
export interface GlobalState {
  // fps removed
  // ...
}
export interface Rectangle {
  timeRange?: {
    start: number  // seconds
    end: number    // seconds
  }
}
```

### 2. `state.ts` — Initial state

Remove `fps: 30` from default global state.

### 3. `toolbar.ts` — Slider and display

**Slider**: switch from frame-number steps to millisecond steps.

```ts
// Load: set slider max to duration in ms
slider.max = String(Math.floor(video.duration * 1000))
slider.step = '1'

// timeupdate: slider value = ms
slider.value = String(Math.round(video.currentTime * 1000))

// slider input: seek by ms
video.currentTime = Number(slider.value) / 1000
```

**Frame display**: delete `displayMode` toggle and frame mode. Always show time via `formatTime()`. The display element becomes non-clickable.

```ts
// Before: toggle between frame "123 / 3600" and time "0:02 / 1:00"
// After: always "0:02 / 1:00" (or "0:02.340 / 1:00:05.200" for long videos)
display.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`
```

Delete `displayMode` variable, `setupDisplayToggle()`, and the click handler on `frame-display`.

### 4. `drawer.ts` — Side panel

**Remove frame/time mode toggle**: delete the `prop-time-mode` button handler and related UI logic. The mode toggle button in HTML should be removed or hidden.

**Simplify timeRange editing**:
- Time inputs always show `HH:MM:SS` format (parsed/formatted without fps)
- Delete all `isFrameMode` branches
- Time hint in rect list: always show time format

**Remove fps references**: delete all `const fps = s.fps` lines and related calculations.

### 5. `export.ts` — FFmpeg filter generation

**`drawboxString`**: remove `_fps` parameter. Always use `between(t, start, end)` for timeRange:

```ts
// Before: frame mode → between(n, start, end), time mode → between(t, start, end)
// After: always between(t, start, end)
if (rect.timeRange) {
  const start = +rect.timeRange.start.toFixed(3)
  const end = +rect.timeRange.end.toFixed(3)
  s += `:enable='between(t,${start},${end})'`
}
```

**`allDrawboxString`** and **`exportJson`**: remove `fps` parameter.

**`exportJson`**: remove `startTimecode`/`endTimecode` fields from JSON output (they depended on fps). Keep `start`/`end` as seconds.

### 6. `timecode.ts` — Time formatting

**Delete** `secondsToTimecode()` and `timecodeToSeconds()` — these convert between seconds and `HH:MM:SS:FF` format, which requires fps.

**Keep** `formatTime()` (already fps-independent).

**Add** `parseTimeInput(text: string): number` — parse user input into seconds. Accepted formats:
- `SS` or `SS.mmm` — e.g. `90`, `1.5`
- `MM:SS` or `MM:SS.mmm` — e.g. `1:30`, `1:30.5`
- `HH:MM:SS` or `HH:MM:SS.mmm` — e.g. `1:02:30`
Returns 0 for unparseable input.

### 7. HTML (`index.html`)

- `#frame-display` (line 31): remove `title="点击切换帧数/时间码"`, content becomes time-only display
- `#prop-time-mode` (line 137): remove the button element entirely
- `#time-start-label` / `#time-end-label` (lines 140-141): remove the label elements (inputs self-document via placeholder)
- `#prop-time-start` / `#prop-time-end`: change `placeholder` from `HH:MM:SS:FF` to `HH:MM:SS`

## Files Modified

| File | Summary |
|------|---------|
| `src/types.ts` | Remove `fps`, simplify `timeRange` |
| `src/state.ts` | Remove `fps: 30` default |
| `src/toolbar.ts` | Slider→ms, delete frame display mode |
| `src/drawer.ts` | Delete frame/time toggle, simplify time inputs |
| `src/export.ts` | Remove fps params, always use `between(t,...)` |
| `src/timecode.ts` | Delete timecode functions, add `parseTimeInput` |
| `index.html` | Remove mode toggle button if present |

## Out of Scope

- Millisecond-precise display in the time range input fields (HH:MM:SS is sufficient for manual entry)
- Custom fps input (removed entirely; if needed in future, it would be a separate feature)
