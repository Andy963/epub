import type { IgnoreClass } from "./epubcfi/ignore";
import type { PlaybackControllerEvents, PlaybackState } from "./playback-controller";
import type { SpeechSegment } from "./read-aloud";
import { speechAnchorToRange } from "./read-aloud";
import { EVENTS } from "./utils/constants";
import {
	collectTextSpansInRange,
	composeIgnoreClass,
	elementHasSpeechHighlightMarker,
	sanitizeClassName,
	toSpinePos,
	unwrapSpeechHighlights,
	wrapTextSpan,
} from "./speech-highlighter/internal";

export interface SpeechHighlighterOptions {
	className?: string;
	ignoreClass?: IgnoreClass;
	highlightStyle?: Partial<CSSStyleDeclaration> | Record<string, string>;
	scroll?: boolean;
}

export class SpeechHighlighter {
	private rendition: any;
	private className: string;
	private ignoreClass: IgnoreClass;
	private highlightStyle?: SpeechHighlighterOptions["highlightStyle"];
	private scroll: boolean;
	private activeAnchor: string | null;
	private activeSpineIndex: number | null;
	private requestId: number;

	private onRenderedBound: ((section: any, view: any) => void) | null;

	constructor(rendition: any, options: SpeechHighlighterOptions = {}) {
		if (!rendition) {
			throw new Error("SpeechHighlighter: rendition is required");
		}

		this.rendition = rendition;
		this.className = sanitizeClassName(options.className, "epubjs-speech-hl");
		this.highlightStyle = options.highlightStyle;
		this.scroll = options.scroll !== false;

		const renditionIgnore: IgnoreClass | undefined = (rendition.settings && rendition.settings.ignoreClass) || undefined;
		const ignoreInjected = (node: any) => elementHasSpeechHighlightMarker(node, this.className);
		this.ignoreClass = composeIgnoreClass(renditionIgnore, options.ignoreClass, ignoreInjected);

		this.activeAnchor = null;
		this.activeSpineIndex = null;
		this.requestId = 0;

		this.onRenderedBound = null;
		this.bindRenditionEvents();
		this.installIgnoreClass();
	}

	get ignore(): IgnoreClass {
		return this.ignoreClass;
	}

	highlight(segment: SpeechSegment | null, options?: { scroll?: boolean }): Promise<void> {
		return this.highlightImpl(segment, options);
	}

	stop(): void {
		this.activeAnchor = null;
		this.activeSpineIndex = null;
		this.requestId++;
		this.clear();
	}

	clear(): void {
		const contentsList = this.getContentsList();
		for (const contents of contentsList) {
			const doc = contents && contents.document;
			if (doc) {
				unwrapSpeechHighlights(doc);
			}
		}
	}

	destroy(): void {
		this.stop();
		this.unbindRenditionEvents();
	}

	createPlaybackControllerEvents(segments: SpeechSegment[]): PlaybackControllerEvents {
		const items = Array.isArray(segments) ? segments : [];
		return {
			onSegmentStart: (index) => {
				const seg = items[index];
				if (seg) {
					this.highlight(seg).catch(() => {
						return;
					});
				}
			},
			onStateChange: (state: PlaybackState) => {
				if (state === "stopped" || state === "ended" || state === "error") {
					this.stop();
				}
			},
		};
	}

	private bindRenditionEvents(): void {
		if (!this.rendition || typeof this.rendition.on !== "function") {
			return;
		}

		this.onRenderedBound = (_section: any, view: any) => {
			if (view && view.settings) {
				try {
					view.settings.ignoreClass = this.ignoreClass;
				} catch (e) {
					// NOOP
				}
			}

			this.refreshForView(view);
		};

		this.rendition.on(EVENTS.RENDITION.RENDERED, this.onRenderedBound);
	}

	private unbindRenditionEvents(): void {
		if (!this.rendition || typeof this.rendition.off !== "function") {
			return;
		}
		if (this.onRenderedBound) {
			this.rendition.off(EVENTS.RENDITION.RENDERED, this.onRenderedBound);
			this.onRenderedBound = null;
		}
	}

	private installIgnoreClass(): void {
		const ignore = this.ignoreClass;
		const rendition = this.rendition;

		if (rendition && rendition.settings) {
			try {
				rendition.settings.ignoreClass = ignore;
			} catch (e) {
				// NOOP
			}
		}

		const manager = rendition && rendition.manager;
		if (manager) {
			try {
				if (manager.settings) manager.settings.ignoreClass = ignore;
			} catch (e) {
				// NOOP
			}
			try {
				if (manager.viewSettings) manager.viewSettings.ignoreClass = ignore;
			} catch (e) {
				// NOOP
			}
		}

		const views = rendition && typeof rendition.views === "function" ? rendition.views() : null;
		const viewList = Array.isArray(views) ? views : views && typeof views.all === "function" ? views.all() : [];
		for (const view of viewList) {
			if (view && view.settings) {
				try {
					view.settings.ignoreClass = ignore;
				} catch (e) {
					// NOOP
				}
			}
		}
	}

	private getContentsList(): any[] {
		if (!this.rendition || typeof this.rendition.getContents !== "function") {
			return [];
		}
		try {
			const contents = this.rendition.getContents();
			return Array.isArray(contents) ? contents : [];
		} catch (e) {
			return [];
		}
	}

	private async highlightImpl(segment: SpeechSegment | null, options?: { scroll?: boolean }): Promise<void> {
		const id = ++this.requestId;

		if (!segment) {
			this.stop();
			return;
		}

		const anchor = String((segment as any).anchor || "");
		if (!anchor) {
			return;
		}

		this.activeAnchor = anchor;
		this.activeSpineIndex = typeof (segment as any).spineIndex === "number" ? (segment as any).spineIndex : null;

		this.installIgnoreClass();
		this.clear();

		const shouldScroll = typeof (options && options.scroll) === "boolean" ? options.scroll : this.scroll;
		if (id !== this.requestId) return;
		if (shouldScroll && this.rendition && typeof this.rendition.display === "function") {
			try {
				await this.rendition.display(anchor);
			} catch (e) {
				// Ignore display errors; try to highlight in already-loaded contents.
			}
		}

		if (id !== this.requestId) return;

		this.refresh();
	}

	private refresh(): void {
		if (!this.activeAnchor) return;

		const spinePos = toSpinePos(this.activeAnchor, this.activeSpineIndex == null ? undefined : this.activeSpineIndex);
		if (spinePos == null) return;

		const contentsList = this.getContentsList();
		const targets = contentsList.filter((c) => c && typeof c.sectionIndex === "number" && c.sectionIndex === spinePos);

		for (const contents of targets) {
			this.applyToDocument(contents && contents.document);
		}
	}

	private refreshForView(view: any): void {
		if (!this.activeAnchor || !view) return;

		const spinePos = toSpinePos(this.activeAnchor, this.activeSpineIndex == null ? undefined : this.activeSpineIndex);
		if (spinePos == null) return;

		if (typeof view.index === "number" && view.index !== spinePos) {
			return;
		}

		const doc = view.contents && view.contents.document;
		if (doc) {
			this.applyToDocument(doc);
		}
	}

	private applyToDocument(doc: Document | undefined | null): void {
		if (!doc || !this.activeAnchor) return;

		unwrapSpeechHighlights(doc);

		let range: Range | null = null;
		try {
			range = speechAnchorToRange(this.activeAnchor, doc, this.ignoreClass);
		} catch (e) {
			range = null;
		}

		if (!range) return;

		if (range.collapsed) {
			return;
		}

		const spans = collectTextSpansInRange(range);
		for (const span of spans) {
			wrapTextSpan(span, this.className, this.highlightStyle);
		}
	}
}

export function createSpeechHighlighter(rendition: any, options: SpeechHighlighterOptions = {}): SpeechHighlighter {
	return new SpeechHighlighter(rendition, options);
}
