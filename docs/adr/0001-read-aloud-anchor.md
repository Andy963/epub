# ADR 0001：Read-aloud anchor 与可组合播放链路

## 状态

Accepted

## 背景

我们希望为“朗读/跟读（read-aloud）”提供一个最小且可扩展的数据模型，使得：

- 朗读片段可以稳定定位到 EPUB 文档的具体位置（用于高亮、滚动、恢复进度）。
- 定位信息可以从 DOM `Range` 生成，并能在后续 round-trip 回 `Range`。
- 在注入高亮 wrapper（例如 `<span class="...">`）后，定位依然尽量稳定。
- 与语音合成（TTS）/播放逻辑解耦：核心库不强制绑定某个播放 UI 或供应商。

## 决策

### 1) 最小数据模型

定义 `SpeechSegment { spineIndex, href, anchor, text }`：

- `spineIndex`：用于快速判断所属 spine item（与 `EpubCFI#spinePos` 对齐）。
- `href`：用于与应用层的导航/资源定位对齐（通常来自 `Section#href`）。
- `anchor`：用于把片段定位回 DOM `Range`（用于高亮/滚动）。
- `text`：用于语音合成输入（由上层生成；库不规定唯一抽取策略）。

### 2) Anchor 选型：使用 `epubcfi(...)`

`anchor` 选择直接复用既有的 `EpubCFI`（`epubcfi(...)` 字符串），并通过 `ignoreClass`（class 或 predicate）保证注入节点后的稳定性。

理由：

- 项目内已有成熟的 `Range <-> CFI` 能力与测试覆盖（包含忽略注入高亮节点的场景）。
- CFI 天然携带 spine 位置与文档内路径信息，适合跨渲染生命周期（reflow / re-render）恢复。
- 相比 XPath/CSS selector + offset，自定义定位器的维护成本与兼容性风险更高。

### 3) 可组合播放链路（非强绑定）

我们将播放链路拆成多个可组合组件：

- `PlaybackController`：播放状态机（play/pause/resume/stop/seek/next/prev），支持重试与错误策略。
- `PlaybackControllerDriver`：播放驱动接口，允许不同音频来源/实现（HTMLAudio、WebAudio、原生桥等）。
- `SpeechHighlighter`：基于 `Rendition` 的高亮注入/清理，并通过合并 `ignoreClass` 保证 anchor round-trip。
- 语音合成（TTS）属于应用层：基础库不内置任何供应商实现，也不处理 API Key。应用层只需实现 `PlaybackControllerDriver`（或在其之上封装自己的 TTS adapter）。

## 备选方案

### A) 自研 locator（XPath/CSS selector + text offsets）

优点：

- 与供应商/格式无关，理论上更通用。

缺点：

- 需要处理大量 DOM 变体（text node split/merge、注入 wrapper、不同解析器差异）。
- 与现有高亮/注释系统需要重复实现忽略规则。

### B) 仅使用 DOM `Range` 序列化

缺点：

- 需要自定义序列化格式，并且依然会遇到注入节点导致的稳定性问题。
- 跨渲染周期恢复的可靠性不如 CFI（尤其在 EPUB 内容被重新解析时）。

## 影响与后果

收益：

- 数据模型最小化，便于上层把朗读/合成/高亮/进度管理组合起来。
- Anchor 复用 `EpubCFI`，稳定性与可维护性更好，避免重复造轮子。
- 播放链路解耦，允许替换 TTS 供应商或播放实现。

代价/风险：

- Anchor 依赖 DOM 结构与解析结果；如果内容被脚本大幅改写或被净化器重写，可能导致 anchor 失效或定位漂移。
- `ignoreClass` 需要在生成 anchor 与还原 anchor 时保持一致，否则注入 wrapper 会污染路径。
- 任何供应商的 API Key 都不能下发到浏览器端；生产环境必须通过服务端代理/转发规避泄露风险。
