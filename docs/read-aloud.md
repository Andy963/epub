# 朗读（Read-aloud）数据模型与定位约定

这里定义一个用于“朗读/跟读（read-aloud）”的最小数据模型 `SpeechSegment`，并约定 `anchor` 的语义、可 round-trip 性质（可还原为 DOM `Range`）、以及在注入高亮节点后的稳定性与边界行为。

## 数据模型

`SpeechSegment` 仅包含 4 个字段：

- `spineIndex`: 章节在 spine 中的 0-based index（与 `EpubCFI#spinePos` 对齐）。
- `href`: 对应 spine item 的 `href`（通常等于 `Section#href`）。
- `anchor`: 可 round-trip 到 DOM `Range` 的定位符（本实现使用 `epubcfi(...)` 字符串）。
- `text`: 需要被朗读的文本（由上层生成；本库不强制规定提取策略）。

## Anchor 定义

`anchor` 定义为一个 `epubcfi(...)` 字符串，满足：

1. 可以从 `Range` 生成：
   - 推荐使用 `Contents#cfiFromRange(range, ignoreClass?)`（因为它天然知道 `cfiBase`）。
   - 或使用 `speechAnchorFromRange(range, cfiBase, ignoreClass?)`。
2. 可以在同一 spine item 对应的 `Document` 上还原为 `Range`：
   - 推荐使用 `Contents#range(anchor, ignoreClass?)`。
   - 或使用 `speechAnchorToRange(anchor, doc, ignoreClass?)`。

```ts
import { speechAnchorFromRange, speechAnchorToRange } from "epubjs";

const ignoreInjectedNodes = (node: Node) => {
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return false;
	}
	const el = node as Element;
	return el.classList.contains("annotator-hl") || el.classList.contains("my-read-aloud-hl");
};

const anchor = speechAnchorFromRange(range, cfiBase, ignoreInjectedNodes);
const restoredRange = speechAnchorToRange(anchor, doc, ignoreInjectedNodes);
```

## Anchor 不变量

### 注入高亮 wrapper 后仍可还原

当页面为了“高亮朗读片段”而向 DOM 注入临时 wrapper 节点（例如 `<span class="...">`）时，anchor 需要保持可解析，并尽量保持语义稳定。

约束与约定：

- 生成 anchor 与还原 anchor **必须使用相同的** `ignoreClass`（推荐用 predicate function，而不是单个 class 字符串）。
- `ignoreClass` 的职责是“把临时注入的 wrapper 当作不存在”，以便：
  - `Range -> anchor` 时忽略这些节点，避免 anchor 被注入节点污染；
  - `anchor -> Range` 时也忽略这些节点，保证注入后仍可定位。
- 注入 wrapper 可能导致 text node split / merge，因此还原出的 `Range` 可能落在不同的 `Text` 节点上；但应保证 `restoredRange.toString()` 与原始选区文本一致（或至少语义一致）。

### Scope and consistency checks

建议把以下一致性作为上层校验（可选，但强烈建议）：

- `spineIndex` 应与 `new EpubCFI(anchor).spinePos` 一致。
- `href` 应与 `spine.get(spineIndex).href` 一致（或至少能互相解析到同一 spine item）。

## 文本分段（可选）

如果你希望从单个 spine item 的 `Document` 里直接生成 `SpeechSegment[]`（带 anchor + 文本），可以使用：

- `speechSegmentsFromDocument(doc, { spineIndex, href, cfiBase }, options?)`

它会按 DOM 阅读顺序收集文本节点，并按句子 + 预算（`maxChars` / `maxSentences`）切分成 segment。默认行为偏“通用可用”，但并不尝试理解 CSS 可见性、ruby 语义或脚注语义（这些属于产品策略层）。

常用选项：

- `ignoreClass`: 与 anchor 一致的 ignore predicate / class（用于对 injected nodes 的稳定 round-trip）。
- `excludedTagNames`: 默认排除 `script/style/noscript/svg/math`。
- `blockTagNames` + `mergeAcrossBlocks`: 控制跨 block 合并 segment 的策略。
- `transformText`: 允许对提取出的文本做归一化/替换（例如过滤脚注符号）。

### 从 `Rendition` 获取分段输入（示例）

在典型的 iframe 渲染模式下，你可以从 `rendition.getContents()` 拿到当前已渲染的 `Contents`，其中包含 `document`、`sectionIndex`、`cfiBase` 等信息（不同 view/manager 下字段可能略有差异，以运行时为准）：

```ts
import { speechSegmentsFromDocument } from "epubjs";

const contentsList = rendition.getContents();
const contents = contentsList && contentsList[0];
if (!contents) {
	throw new Error("No contents rendered");
}

const doc = contents.document;
const spineIndex = contents.sectionIndex;
const cfiBase = contents.cfiBase;
const href = (contents.section && contents.section.href) || "";

const segments = speechSegmentsFromDocument(doc, { spineIndex, href, cfiBase });
```

## 语音合成与播放对接（可选）

本仓库提供了“可组合”的积木，而不是一键式 `rendition.readAloud()`：

- `SpeechSegment`：承载文本与定位信息。
- `PlaybackController`：负责播放状态机、重试与跳过策略。
- `SpeechHighlighter`：在 `Rendition` 上根据 segment.anchor 注入/清理高亮，并可选滚动到对应位置。

语音合成（TTS）与音频播放属于业务/应用层职责：不同产品对供应商、缓存、预取、错误策略、以及播放设备（HTMLAudio / WebAudio / Native bridge）差异很大。基础库只提供 `PlaybackControllerDriver` 接口，由应用层实现。

最小串联示例（仅展示 API 形状；TTS 请求应走你自己的服务端代理）：

```ts
import {
	speechSegmentsFromDocument,
	PlaybackController,
	createSpeechHighlighter,
} from "epubjs";

const segments = speechSegmentsFromDocument(
	doc,
	{ spineIndex, href, cfiBase },
	{ maxChars: 800, maxSentences: 6 }
);

const highlighter = createSpeechHighlighter(rendition, {
	className: "my-read-aloud-hl",
	scroll: true,
});

const audio = new Audio();
let currentUrl = "";

const driver = {
	playSegment: async (items, index, opts) => {
		const seg = items[index];
		if (!seg) throw new Error("Missing segment");

		const res = await fetch("/api/tts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text: seg.text }),
			signal: opts && opts.signal ? opts.signal : undefined,
		});
		if (!res.ok) throw new Error(`TTS failed (${res.status})`);

		const blob = await res.blob();
		if (currentUrl) URL.revokeObjectURL(currentUrl);
		currentUrl = URL.createObjectURL(blob);
		audio.src = currentUrl;

		await audio.play();
		await new Promise((resolve, reject) => {
			const onEnded = () => cleanup(resolve);
			const onError = (e) => cleanup(() => reject(e));
			const cleanup = (fn) => {
				audio.removeEventListener("ended", onEnded);
				audio.removeEventListener("error", onError);
				fn();
			};
			audio.addEventListener("ended", onEnded, { once: true });
			audio.addEventListener("error", onError, { once: true });
		});
	},
	pause: () => audio.pause(),
	resume: () => audio.play(),
	stop: () => {
		audio.pause();
		audio.removeAttribute("src");
		audio.load();
		if (currentUrl) URL.revokeObjectURL(currentUrl);
		currentUrl = "";
	},
};

const controller = new PlaybackController({
	segments,
	driver,
	...highlighter.createPlaybackControllerEvents(segments),
});

controller.play();
```

## 安全与部署注意事项

- 任何供应商的 API Key 都不应在浏览器端暴露。推荐做法：把语音合成请求转发到你自己的服务端，由服务端持有密钥并返回音频数据。
- TTS 返回的音频可能较大，建议：
  - 在上层实现小步预取（例如提前合成接下来的 1–2 个 segment）；
  - 合理设置 `maxChars/maxSentences`，避免单段过长导致延迟与失败率上升；
  - 在上层实现持久化缓存（例如 IndexedDB），避免重复合成。

## 边界行为

以下内容强调“应当如何理解 anchor 与 text 的关系”，而不是强行规定唯一行为；不同产品对朗读体验的偏好不同。

### Hidden nodes

- `EpubCFI` 的定位基于 DOM 结构，并不理解 CSS layout；因此 anchor 可以定位到任何存在于 DOM 中的节点，包括隐藏内容（例如 `display: none`、`visibility: hidden`、`aria-hidden="true"` 等）。
- 如果你的 read-aloud 需要“只朗读可见内容”，建议在生成 `SpeechSegment.text` 时显式过滤隐藏节点；并确保 anchor 的 `Range` 与你的“可朗读文本抽取”策略一致。
- 如果后续渲染/脚本把某段内容从 DOM 中移除，anchor 还原可能失败或退化为相邻节点定位；上层应当能容忍并做降级处理（例如跳过该 segment 或重新生成）。

### Ruby

- `ruby/rt/rp` 的语义在不同语言场景下差异很大：有的希望朗读 `rt`（注音），有的希望朗读 base text，有的希望二者结合。
- anchor 的 round-trip 只保证“DOM 位置可还原”，不保证“朗读文本符合预期”。建议在生成 `SpeechSegment.text` 时显式定义 ruby 策略：
  - prefer `rt` when present
  - or ignore `rt` and speak base text
  - or emit both with separators

### Footnotes

- Footnote reference 在 EPUB 中常见为 `<a epub:type="noteref">` / `role="doc-noteref"` 等；目标可能在同一文档，也可能跨 `href`。
- 推荐把 footnote reference 作为 segment 边界处理，并明确策略：
  - skip footnote references
  - speak reference marker only
  - inline-expand the footnote content as separate `SpeechSegment`(s)
- 如果要自动识别脚注引用，可复用 `src/utils/footnotes.ts` 相关工具（例如 reference 分类与 target 提取）。
