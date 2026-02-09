import EpubCFI from "../epubcfi";
import { EVENTS } from "../utils/constants";
import { classifyFootnoteReference, extractFootnoteTarget, getReferencedType } from "../utils/footnotes";

/**
 * Hook to handle link clicks in rendered content
 * @param  {Contents} contents
 * @private
 */
export function handleLinks(contents) {
	if (contents) {
		contents.on(EVENTS.CONTENTS.LINK_CLICKED, (href, link, event) => {
			let relative = this.book.path.relative(href);
			let scheme;
			if (typeof relative === "string") {
				const match = relative.match(/^([a-zA-Z][a-zA-Z+.-]*):/);
				scheme = match && match[1] ? match[1].toLowerCase() : undefined;
			}
			const isExternal = Boolean(scheme);
			const allowAutoOpen = scheme === "http" || scheme === "https";

			const footnotes = this.settings.footnotes;
			const footnotesEnabled = footnotes === true || (footnotes && typeof footnotes === "object");
			const detectFootnotes = !(footnotes && typeof footnotes === "object" && footnotes.detect === false);
			const extract = !(footnotes && typeof footnotes === "object" && footnotes.extract === false);

			if (isExternal) {
				if (event && typeof event.preventDefault === "function") {
					event.preventDefault();
				}

				this.emit(EVENTS.RENDITION.EXTERNAL_LINK, {
					href: relative,
					link,
					contents,
					event
				});

				if (this.settings.openExternalLinks !== false && allowAutoOpen) {
					try {
						if (typeof globalThis !== "undefined" && typeof globalThis.open === "function") {
							globalThis.open(relative, "_blank");
						}
					} catch (e) {
						// NOOP
					}
				}
				return;
			}

			if (footnotesEnabled && link) {
				const { yes, maybe } = classifyFootnoteReference(link, contents.window);
				if (yes || (detectFootnotes && maybe())) {
					if (event && typeof event.preventDefault === "function") {
						event.preventDefault();
					}

					const promise = this.resolveFootnote(relative, { extract });
					this.emit(EVENTS.RENDITION.FOOTNOTE, {
						href: relative,
						link,
						contents,
						event,
						promise
					});

					promise.catch(() => {
						this.display(relative);
					});
					return;
				}
			}

			this.display(relative);
		});
	}
}

export async function resolveFootnote(href, options) {
	options = options || {};
	const extract = options.extract !== false;

	if (!href || typeof href !== "string") {
		throw new Error("href is required");
	}

	const relative = this.book && this.book.path && href.charAt(0) === "/" ? this.book.path.relative(href) : href;
	const parts = relative.split("#");
	const section = this.book && this.book.spine ? this.book.spine.get(relative) : undefined;

	if (!section) {
		throw new Error("No section found");
	}

	await this.book.spineLoader.load(section);

	const doc = section.document;
	if (!doc) {
		throw new Error("Section is not loaded");
	}

	const fragment = parts.length > 1 ? parts.slice(1).join("#") : "";
	let target;
	let type = null;
	let hidden = false;

	if (fragment) {
		const decoded = decodeURIComponent(fragment);
		if (this.epubcfi.isCfiString(decoded)) {
			target = new EpubCFI(decoded).toRange(doc);
		} else {
			const byId = typeof doc.getElementById === "function" ? doc.getElementById(decoded) : undefined;
			if (byId) {
				target = byId;
			} else {
				const safeSelector = decoded.replace(/\\\\/g, "\\\\\\\\").replace(/\"/g, '\\\\\"');
				target = doc.querySelector(`[id=\"${safeSelector}\"]`);
				if (!target) {
					target = doc.querySelector(`[name=\"${safeSelector}\"]`);
				}
			}
		}
	}

	if (!target) {
		throw new Error("No fragment target found");
	}

	let extractedTarget = target;
	if (extract && !target.startContainer) {
		extractedTarget = extractFootnoteTarget(doc, () => target);
	}

	if (!extractedTarget.startContainer) {
		type = getReferencedType(extractedTarget);
		if (type === "footnote" && typeof extractedTarget.matches === "function" && extractedTarget.matches("aside")) {
			hidden = true;
		}
	}

	let range;
	if (extractedTarget && extractedTarget.startContainer) {
		range = extractedTarget;
	} else {
		range = doc.createRange();
		if (extractedTarget && typeof extractedTarget.matches === "function" && extractedTarget.matches("li, aside")) {
			range.selectNodeContents(extractedTarget);
		} else {
			range.selectNode(extractedTarget);
		}
	}

	const container = doc.createElement("div");
	container.appendChild(range.cloneContents());

	return {
		href: relative,
		sectionIndex: section.index,
		sectionHref: section.href,
		type,
		hidden,
		target: extractedTarget,
		html: container.innerHTML,
		text: (container.textContent || "").trim()
	};
}

