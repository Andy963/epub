# Read-aloud 实现审查报告

## 审查范围

- `src/read-aloud.ts` — 文本分段
- `src/playback-controller.ts` — 播放状态机控制器
- `src/speech-highlighter.ts` — DOM 高亮同步

> 注：基础库已移除 OpenAI 直连实现，因此 `src/openai-tts*.ts` 不再属于审查范围；TTS 供应商接入应由业务/应用层实现（例如通过同源服务端代理）。

---

## 问题列表

### 1. DOM 文本节点碎片化（高亮正确性 + 性能）

**位置：** `src/speech-highlighter.ts` — `wrapTextSpan()` (L198–L228)、`unwrapSpeechHighlights()` (L230–L258)

**问题：**
`wrapTextSpan()` 使用 `Text.splitText()` 拆分文本节点：如果清理高亮时不对受影响的父节点做 `normalize()`，会导致文本节点碎片化累积并拖慢后续操作；如果对整个 `body` 做全量 `normalize()`，又会带来不必要的全树遍历与潜在副作用。

**影响：**
- 反复高亮导致文本节点不断碎片化
- CFI 锚点漂移（CFI 解析依赖文本节点结构）
- 长时间使用后性能退化（DOM 节点数持续增长）

**状态：** 已修复

**修复：** `unwrapSpeechHighlights()` 现在只对“实际被 unwrap 的 wrapper 的父节点集合”做局部 `normalize()`，避免全量 `body.normalize()`。

---

### 2. 音频驱动 `stop()` 不重置暂停状态 → 可能死锁

**位置：** `src/openai-tts-playback.ts`（已移除）

**问题：**
`stop()` 没有将 `this.paused` 设为 `false`，也没有 resolve `resumeDeferred`。

**复现步骤：**
1. 调用 `pause()` → `this.paused = true`
2. 调用 `stop()`  → `this.paused` 仍为 `true`
3. 再次调用 `playSegment()` → 内部调用 `stop()`，然后进入 `awaitIfPaused()`
4. 因为 `this.paused` 仍为 `true`，`awaitIfPaused()` 永久阻塞

**影响：** 播放在 "暂停 → 停止 → 播放" 流程后挂起。

**状态：** 不再适用（基础库已移除 OpenAI 音频驱动）

---

### 3. 音频事件回退路径泄漏

**位置：** `src/openai-tts-playback.ts`（已移除）

**问题：**
`catch` 分支中通过属性赋值设置了 `this.audio.onended` 和 `this.audio.onerror`（L267–L268），但 `cleanup()` 只通过 `removeEventListener` 清理，不会清除 `.onended/.onerror` 属性。

**影响：**
- 闭包引用无法释放（内存泄漏）
- 后续播放时可能触发残留的事件处理器
- 覆盖应用层或用户设置的处理器

**状态：** 不再适用（基础库已移除 OpenAI 音频驱动）

---

### 4. 并发 `playSegment()` 可能导致前一个 Promise 挂起

**位置：** `src/openai-tts-playback.ts`（已移除）

**问题：**
`playSegment()` 开头调用 `this.stop()` 清除音频源，但前一次调用仍在 `awaitEndedOrError()` 中等待。清除 `src` 后，浏览器可能既不触发 `ended` 也不触发 `error` 事件，导致前一个 Promise 永远不 resolve。

**影响：** 挂起的 Promise / 播放状态卡死。

**状态：** 不再适用（基础库已移除 OpenAI 音频驱动）

---

### 5. 分段逻辑忽略 `ignoreClass`

**位置：** `src/read-aloud.ts` — `collectSentenceUnits()` (L257–L355)

**状态：** 需要澄清（更偏“约束说明”而非代码 bug）

**说明：**
- `EpubCFI` 的 `ignoreClass` 语义是“忽略结构影响（把 wrapper 当作不存在）”，并不等同于“忽略文本内容”。因此分段遍历文本节点时不跳过 `ignoreClass` 子树是合理的；否则会丢失被 wrapper 包裹的真实内容。
- 真正需要约束的是：`ignoreClass` 应只匹配“透明 wrapper”（例如仅包裹单个 `Text` 节点的 `<span>`），不要匹配会引入/重排可见文本的复杂节点；否则 CFI 的忽略模式可能无法精确 round-trip。

**建议：**
- 如果朗读需要跳过某类内容（脚注、隐藏节点等），应通过 `excludedTagNames` / `transformText` 或更上层规则处理，而不要复用 `ignoreClass`。

---

### 6. 高亮竞态：过时请求仍可导致页面跳转

**位置：** `src/speech-highlighter.ts` — `highlightImpl()` (L443–L474)

**问题：**
`requestId` 的检查（L471）在 `rendition.display(anchor)` 之后才执行。快速连续高亮时，旧请求仍会执行 `display()`，导致不必要的页面跳转。

**影响：** 快速切换段落时出现 "页面闪跳"。

**状态：** 已修复

**修复：** 在调用 `rendition.display()` 之前增加 `requestId` 检查，避免过时请求触发页面跳转。

---

### 7. 预取与实时播放共享优先级

**位置：** `src/openai-tts.ts`（已移除）

**问题：**
`synthesizeSegmentInternal()` 统一使用 `priority = 1`，预取请求可能占满 `maxConcurrentRequests` 的有限槽位，延迟当前正在播放的段落合成。

**影响：** 音频启动延迟增大 / 播放卡顿。

**状态：** 不再适用（基础库已移除 OpenAI TTS 适配器）

---

### 8. 安全：客户端暴露 API Key

**位置：** `src/openai-tts.ts`（已移除）

**问题：**
`apiKey` 直接在浏览器端通过 `Authorization: Bearer` 发送（L685）。如果在浏览器中使用，API Key 会完全暴露给用户（DevTools、网络日志、源码映射等）。此外 `baseUrl` 可配置，如果被用户控制，可构成凭证外泄向量（将 Bearer token 发送到攻击者控制的服务器）。

**影响：** API Key 泄露、未授权使用、计费欺诈。

**状态：** 已通过架构调整解决（基础库不再处理/要求任何 API Key）

---

## 状态汇总

| # | 问题 | 状态 |
|---|------|------|
| 1 | DOM 文本节点碎片化 | 已修复 |
| 2 | `stop()` 不重置暂停状态 | 不再适用（范围移除） |
| 3 | 事件回退路径泄漏 | 不再适用（范围移除） |
| 4 | 并发 `playSegment()` 挂起 | 不再适用（范围移除） |
| 5 | 分段忽略 `ignoreClass` | 约束澄清 |
| 6 | 高亮竞态页面跳转 | 已修复 |
| 7 | 预取优先级问题 | 不再适用（范围移除） |
| 8 | 客户端暴露 API Key | 已通过架构调整解决 |
