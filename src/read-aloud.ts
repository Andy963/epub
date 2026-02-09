import EpubCFI from "./epubcfi";
import type { IgnoreClass } from "./epubcfi/ignore";

export type SpeechAnchor = string;

export interface SpeechSegment {
	spineIndex: number;
	href: string;
	anchor: SpeechAnchor;
	text: string;
}

export function speechAnchorFromRange(range: Range, cfiBase: string | object, ignoreClass?: IgnoreClass): SpeechAnchor {
	return new EpubCFI(range, cfiBase, ignoreClass).toString();
}

export function speechAnchorToRange(anchor: SpeechAnchor, doc: Document, ignoreClass?: IgnoreClass): Range {
	return new EpubCFI(anchor).toRange(doc, ignoreClass);
}

export interface SpeechSegmentationBudget {
	maxChars?: number;
	maxSentences?: number;
}

export interface SpeechSegmentationOptions extends SpeechSegmentationBudget {
	locales?: string | string[];
	ignoreClass?: IgnoreClass;
	root?: Element | null;
	mergeAcrossBlocks?: boolean;
	blockTagNames?: string[];
	excludedTagNames?: string[];
	transformText?: (text: string) => string;
}

export interface SpeechSegmentationInput {
	spineIndex: number;
	href: string;
	cfiBase: string | object;
}

type DomPoint = { node: Text; offset: number };

type SentenceUnit = {
	blockId: number;
	hardBreakBefore: boolean;
	start: DomPoint;
	end: DomPoint;
	text: string;
};

const DEFAULT_BUDGET: Required<SpeechSegmentationBudget> = {
	maxChars: 800,
	maxSentences: 8,
};

const DEFAULT_BLOCK_TAGS = [
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"li",
	"blockquote",
	"pre",
	"dt",
	"dd",
	"figcaption",
	"caption",
	"td",
	"th",
	"address",
	"div",
	"section",
	"article",
	"main",
];

const DEFAULT_EXCLUDED_TAGS = ["script", "style", "noscript", "svg", "math"];

function findDefaultRoot(doc: Document): Element | null {
	if (doc.body) {
		return doc.body;
	}

	const body = doc.getElementsByTagName("body");
	if (body && body.length) {
		return body[0];
	}

	const xhtmlNs = "http://www.w3.org/1999/xhtml";
	const bodyNs = doc.getElementsByTagNameNS && doc.getElementsByTagNameNS(xhtmlNs, "body");
	if (bodyNs && bodyNs.length) {
		return bodyNs[0] as any;
	}

	return doc.documentElement;
}

function normalizeSpeechText(value: string): string {
	const text = String(value || "")
		// Soft hyphen & common format chars
		.replace(/(?:\u00ad|\u200b|\u200c|\u200d|\u2060|\ufeff)/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return text;
}

function makeTagNameSet(tagNames: string[] | undefined, fallback: string[]): Set<string> {
	const list = (tagNames && tagNames.length ? tagNames : fallback).map((t) => String(t || "").toUpperCase()).filter(Boolean);
	return new Set(list);
}

function isWithinExcludedElement(node: Text, excludedTags: Set<string>): boolean {
	let el = node.parentElement;
	while (el) {
		if (excludedTags.has(el.tagName)) {
			return true;
		}
		el = el.parentElement;
	}
	return false;
}

function getBlockContainer(node: Text, root: Element, blockTags: Set<string>): Element {
	let el: Element | null = node.parentElement;
	while (el) {
		if (blockTags.has(el.tagName)) {
			return el;
		}
		if (el === root) {
			break;
		}
		el = el.parentElement;
	}
	return root;
}

type TextRun = { node: Text; start: number; end: number };

function buildTextRuns(nodes: Text[]): { text: string; runs: TextRun[] } {
	let text = "";
	const runs: TextRun[] = [];
	for (const node of nodes) {
		const data = node && typeof node.data === "string" ? node.data : "";
		const start = text.length;
		text += data;
		runs.push({ node, start, end: text.length });
	}
	return { text, runs };
}

function resolveDomPoint(runs: TextRun[], index: number): DomPoint {
	if (!runs.length) {
		throw new Error("Failed to resolve dom point: empty text runs");
	}

	const total = runs[runs.length - 1].end;
	if (index <= 0) {
		return { node: runs[0].node, offset: 0 };
	}
	if (index >= total) {
		const last = runs[runs.length - 1];
		return { node: last.node, offset: last.node.data.length };
	}

	let lo = 0;
	let hi = runs.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const run = runs[mid];
		if (index < run.start) {
			hi = mid - 1;
		} else if (index >= run.end) {
			lo = mid + 1;
		} else {
			return { node: run.node, offset: index - run.start };
		}
	}

	// Fallback: should never happen.
	const last = runs[runs.length - 1];
	return { node: last.node, offset: last.node.data.length };
}

function splitSentencesWithIntl(text: string, locales: string | string[] | undefined): Array<{ start: number; end: number }> | null {
	const IntlAny: any = typeof Intl !== "undefined" ? (Intl as any) : null;
	if (!IntlAny || !IntlAny.Segmenter) {
		return null;
	}

	try {
		const segmenter = new IntlAny.Segmenter(locales, { granularity: "sentence" });
		const spans: Array<{ start: number; end: number }> = [];
		for (const part of segmenter.segment(text)) {
			if (!part) {
				continue;
			}
			const start = typeof part.index === "number" ? part.index : 0;
			const segment = typeof part.segment === "string" ? part.segment : "";
			const end = start + segment.length;
			spans.push({ start, end });
		}
		return spans.length ? spans : null;
	} catch (e) {
		return null;
	}
}

function splitSentencesFallback(text: string): Array<{ start: number; end: number }> {
	const spans: Array<{ start: number; end: number }> = [];

	let start = 0;
	const re = /[.!?。！？…]+(?:["'”’)\]]+)?\s+|\n+/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		const end = match.index + match[0].length;
		if (end > start) {
			spans.push({ start, end });
		}
		start = end;
	}
	if (start < text.length) {
		spans.push({ start, end: text.length });
	}
	return spans;
}

function splitSentences(text: string, locales: string | string[] | undefined): Array<{ start: number; end: number }> {
	const intl = splitSentencesWithIntl(text, locales);
	if (intl) {
		return intl;
	}
	return splitSentencesFallback(text);
}

function trimSpan(text: string, start: number, end: number): { start: number; end: number } {
	while (start < end && /\s/u.test(text[start])) {
		start++;
	}
	while (end > start && /\s/u.test(text[end - 1])) {
		end--;
	}
	return { start, end };
}

function createTextWalker(doc: Document, root: Element): TreeWalker | null {
	const anyDoc: any = doc as any;
	if (anyDoc && typeof anyDoc.createTreeWalker === "function") {
		return anyDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
	}
	return null;
}

function collectSentenceUnits(doc: Document, root: Element, options: SpeechSegmentationOptions): SentenceUnit[] {
	const blockTags = makeTagNameSet(options.blockTagNames, DEFAULT_BLOCK_TAGS);
	const excludedTags = makeTagNameSet(options.excludedTagNames, DEFAULT_EXCLUDED_TAGS);
	const transformText = options.transformText || normalizeSpeechText;

	const units: SentenceUnit[] = [];
	let currentNodes: Text[] = [];
	let currentContainer: Element | null = null;
	let blockId = 0;
	let hardBreakBeforeNext = true;

	const flushSpan = () => {
		if (!currentNodes.length) {
			currentContainer = null;
			return;
		}

		const spanHardBreak = hardBreakBeforeNext;
		hardBreakBeforeNext = false;

		const { text, runs } = buildTextRuns(currentNodes);
		currentNodes = [];

		const sentences = splitSentences(text, options.locales);
		let firstUnit = true;
		for (const sentence of sentences) {
			const trimmed = trimSpan(text, sentence.start, sentence.end);
			if (trimmed.end <= trimmed.start) {
				continue;
			}

			const raw = text.slice(trimmed.start, trimmed.end);
			const spoken = transformText(raw);
			if (!spoken) {
				continue;
			}

			const start = resolveDomPoint(runs, trimmed.start);
			const end = resolveDomPoint(runs, trimmed.end);
			units.push({
				blockId,
				hardBreakBefore: firstUnit ? spanHardBreak : false,
				start,
				end,
				text: spoken,
			});
			firstUnit = false;
		}

		blockId++;
		currentContainer = null;
	};

	const walker = createTextWalker(doc, root);
	const iterateTextNodes = (visit: (node: Text) => void) => {
		if (walker) {
			let n: Node | null;
			while ((n = walker.nextNode())) {
				visit(n as Text);
			}
			return;
		}

		const stack: Node[] = [root];
		while (stack.length) {
			const node = stack.pop();
			if (!node) continue;
			if (node.nodeType === Node.TEXT_NODE) {
				visit(node as Text);
				continue;
			}
			let child = node.lastChild;
			while (child) {
				stack.push(child);
				child = child.previousSibling;
			}
		}
	};

	iterateTextNodes((textNode) => {
		if (isWithinExcludedElement(textNode, excludedTags)) {
			flushSpan();
			hardBreakBeforeNext = true;
			return;
		}

		const container = getBlockContainer(textNode, root, blockTags);
		if (currentContainer && container !== currentContainer) {
			flushSpan();
		}

		currentContainer = container;
		currentNodes.push(textNode);
	});

	flushSpan();

	return units;
}

function rangeFromPoints(doc: Document, start: DomPoint, end: DomPoint): Range {
	const anyDoc: any = doc as any;
	if (!anyDoc || typeof anyDoc.createRange !== "function") {
		throw new Error("Document.createRange is required for speech segmentation");
	}
	const range = doc.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	return range;
}

/**
 * Extract and segment readable text into SpeechSegment[] for a single spine item document.
 *
 * The output is stable in reading order. Each segment contains:
 * - text: normalized speech text
 * - anchor: a CFI range that can be restored to DOM Range
 */
export function speechSegmentsFromDocument(
	doc: Document,
	input: SpeechSegmentationInput,
	options: SpeechSegmentationOptions = {}
): SpeechSegment[] {
	const root = (typeof options.root !== "undefined" ? options.root : null) || findDefaultRoot(doc);
	if (!root) {
		return [];
	}

	const budget: Required<SpeechSegmentationBudget> = {
		maxChars: typeof options.maxChars === "number" ? options.maxChars : DEFAULT_BUDGET.maxChars,
		maxSentences: typeof options.maxSentences === "number" ? options.maxSentences : DEFAULT_BUDGET.maxSentences,
	};

	const mergeAcrossBlocks = options.mergeAcrossBlocks !== false;
	const units = collectSentenceUnits(doc, root, options);
	if (!units.length) {
		return [];
	}

	const segments: SpeechSegment[] = [];

	let currentStart: DomPoint | null = null;
	let currentEnd: DomPoint | null = null;
	let currentBlockId: number | null = null;
	let currentTextParts: string[] = [];
	let currentChars = 0;
	let currentSentences = 0;

	const flushSegment = () => {
		if (!currentStart || !currentEnd || !currentTextParts.length) {
			currentStart = null;
			currentEnd = null;
			currentBlockId = null;
			currentTextParts = [];
			currentChars = 0;
			currentSentences = 0;
			return;
		}

		const range = rangeFromPoints(doc, currentStart, currentEnd);
		const anchor = speechAnchorFromRange(range, input.cfiBase, options.ignoreClass);
		segments.push({
			spineIndex: input.spineIndex,
			href: input.href,
			anchor,
			text: currentTextParts.join(" "),
		});

		currentStart = null;
		currentEnd = null;
		currentBlockId = null;
		currentTextParts = [];
		currentChars = 0;
		currentSentences = 0;
	};

	for (const unit of units) {
		const needsHardBreak = unit.hardBreakBefore ||
			(!mergeAcrossBlocks && currentBlockId !== null && unit.blockId !== currentBlockId);

		const addChars = (currentTextParts.length ? 1 : 0) + unit.text.length;
		const wouldExceed = currentTextParts.length > 0 && (
			(currentSentences + 1 > budget.maxSentences) ||
			(currentChars + addChars > budget.maxChars)
		);

		if (!currentStart || !currentEnd || needsHardBreak || wouldExceed) {
			if (currentTextParts.length) {
				flushSegment();
			}
			currentStart = unit.start;
			currentEnd = unit.end;
			currentBlockId = unit.blockId;
			currentTextParts = [unit.text];
			currentChars = unit.text.length;
			currentSentences = 1;
			continue;
		}

		currentEnd = unit.end;
		currentBlockId = unit.blockId;
		currentTextParts.push(unit.text);
		currentChars += addChars;
		currentSentences += 1;
	}

	flushSegment();

	return segments;
}
