import EpubCFI from "../epubcfi";
import type { IgnoreClass } from "../epubcfi/ignore";

type HighlightStyle = Partial<CSSStyleDeclaration> | Record<string, string> | undefined;

function isElementNode(node: any): node is Element {
	return !!node && node.nodeType === Node.ELEMENT_NODE;
}

function getClassAttribute(el: any): string {
	if (!el) return "";
	if (el.classList && typeof el.classList.value === "string") {
		return el.classList.value;
	}
	if (typeof el.getAttribute === "function") {
		return String(el.getAttribute("class") || "");
	}
	return "";
}

function elementHasClass(el: any, className: string): boolean {
	if (!el || !className) return false;
	if (el.classList && typeof el.classList.contains === "function") {
		try {
			return el.classList.contains(className);
		} catch (e) {
			// NOOP
		}
	}
	const cls = " " + getClassAttribute(el).replace(/\s+/g, " ").trim() + " ";
	return cls.indexOf(" " + className + " ") >= 0;
}

function ignoreToPredicate(ignore: IgnoreClass | undefined | null): (node: any) => boolean {
	if (!ignore) return () => false;
	if (typeof ignore === "function") {
		return (node) => {
			try {
				return ignore(node) === true;
			} catch (e) {
				return false;
			}
		};
	}
	const cls = String(ignore || "").trim();
	if (!cls) return () => false;
	return (node) => isElementNode(node) && elementHasClass(node, cls);
}

function rangeIntersectsNode(range: Range, node: Node): boolean {
	const anyRange: any = range as any;
	if (anyRange && typeof anyRange.intersectsNode === "function") {
		try {
			return anyRange.intersectsNode(node);
		} catch (e) {
			// Fallthrough
		}
	}

	const doc = (node as any).ownerDocument || (range.startContainer as any).ownerDocument;
	if (!doc || typeof doc.createRange !== "function") {
		return false;
	}

	try {
		const nodeRange = doc.createRange();
		nodeRange.selectNodeContents(node);
		return (
			range.compareBoundaryPoints(Range.END_TO_START, nodeRange) > 0 &&
			range.compareBoundaryPoints(Range.START_TO_END, nodeRange) < 0
		);
	} catch (e) {
		return false;
	}
}

type TextSpan = { node: Text; start: number; end: number };

export function sanitizeClassName(value: any, fallback: string): string {
	const raw = String(value || "").trim();
	if (!raw) return fallback;
	return raw.split(/\s+/g)[0] || fallback;
}

export function elementHasSpeechHighlightMarker(el: any, className: string): boolean {
	if (!isElementNode(el)) return false;
	if (elementHasClass(el, className)) return true;
	if (typeof el.getAttribute === "function") {
		return el.getAttribute("data-epubjs-speech-hl") === "1";
	}
	return false;
}

export function composeIgnoreClass(...ignores: Array<IgnoreClass | undefined | null | false>): IgnoreClass {
	const predicates = ignores
		.map((i) => ignoreToPredicate(i || undefined))
		.filter((fn) => typeof fn === "function");
	if (predicates.length === 1) {
		return predicates[0] as any;
	}
	return (node: any) => {
		for (const fn of predicates) {
			if (fn(node)) return true;
		}
		return false;
	};
}

export function collectTextSpansInRange(range: Range): TextSpan[] {
	const spans: TextSpan[] = [];
	let root: any = range.commonAncestorContainer;
	if (!root) return spans;

	if (root.nodeType === Node.TEXT_NODE) {
		root = root.parentNode;
	}

	const doc = (root && root.ownerDocument) || (range.startContainer as any).ownerDocument;
	if (!doc || typeof doc.createTreeWalker !== "function") {
		return spans;
	}

	let walker: TreeWalker | null = null;
	try {
		walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
	} catch (e) {
		walker = null;
	}
	if (!walker) return spans;

	let node: any;
	while ((node = walker.nextNode())) {
		if (!node || node.nodeType !== Node.TEXT_NODE) continue;
		if (!rangeIntersectsNode(range, node)) continue;

		const textNode = node as Text;
		const len = textNode.data ? textNode.data.length : 0;
		let start = textNode === range.startContainer ? range.startOffset : 0;
		let end = textNode === range.endContainer ? range.endOffset : len;

		start = Math.max(0, Math.min(len, start));
		end = Math.max(0, Math.min(len, end));
		if (end <= start) continue;

		const slice = textNode.data.slice(start, end);
		if (!slice || !slice.trim()) continue;

		spans.push({ node: textNode, start, end });
	}

	return spans;
}

function applyInlineStyles(el: HTMLElement, styles: HighlightStyle): void {
	const s: any = el.style as any;

	// Default style
	try {
		s.backgroundColor = "rgba(255, 255, 0, 0.35)";
		s.borderRadius = "0.15em";
		s.boxDecorationBreak = "clone";
		(s as any).webkitBoxDecorationBreak = "clone";
	} catch (e) {
		// NOOP
	}

	if (!styles) return;

	try {
		const setProperty = s && typeof s.setProperty === "function" ? s.setProperty.bind(s) : null;
		for (const key of Object.keys(styles as any)) {
			const val: any = (styles as any)[key];
			if (val == null) continue;
			try {
				if (setProperty && key.indexOf("-") >= 0) {
					setProperty(key, String(val));
				} else {
					s[key] = String(val);
				}
			} catch (e) {
				// NOOP
			}
		}
	} catch (e) {
		// NOOP
	}
}

export function wrapTextSpan(span: TextSpan, className: string, styles: HighlightStyle): HTMLElement | null {
	const node = span.node;
	const doc = (node as any).ownerDocument as Document | null;
	if (!doc || !node.parentNode) return null;

	const len = node.data ? node.data.length : 0;
	let start = Math.max(0, Math.min(len, span.start));
	let end = Math.max(0, Math.min(len, span.end));
	if (end <= start) return null;

	let target: Text = node;
	if (start > 0) {
		target = target.splitText(start);
	}

	const take = end - start;
	if (take < (target.data ? target.data.length : 0)) {
		target.splitText(take);
	}

	const wrapper = doc.createElement("span") as HTMLElement;
	wrapper.setAttribute("data-epubjs-speech-hl", "1");
	wrapper.className = className;
	applyInlineStyles(wrapper, styles);

	const parent = target.parentNode;
	parent.insertBefore(wrapper, target);
	wrapper.appendChild(target);

	return wrapper;
}

export function unwrapSpeechHighlights(doc: Document): void {
	if (!doc || typeof doc.querySelectorAll !== "function") return;

	let highlights: NodeListOf<Element>;
	try {
		highlights = doc.querySelectorAll('[data-epubjs-speech-hl="1"]');
	} catch (e) {
		return;
	}

	const parents = new Set<Node>();
	const list = Array.from(highlights);
	for (const el of list) {
		const parent = el.parentNode;
		if (!parent) continue;
		parents.add(parent);
		while (el.firstChild) {
			parent.insertBefore(el.firstChild, el);
		}
		try {
			parent.removeChild(el);
		} catch (e) {
			// NOOP
		}
	}

	for (const parent of parents) {
		try {
			if (parent && typeof (parent as any).normalize === "function") {
				(parent as any).normalize();
			}
		} catch (e) {
			// NOOP
		}
	}
}

export function toSpinePos(anchor: string, fallback?: number): number | null {
	try {
		const cfi = new EpubCFI(anchor);
		if (typeof (cfi as any).spinePos === "number") {
			return (cfi as any).spinePos;
		}
	} catch (e) {
		// NOOP
	}

	if (typeof fallback === "number" && isFinite(fallback)) {
		return Math.floor(fallback);
	}

	return null;
}

