import EpubCFI from "../epubcfi";

/**
 * Find a DOM Range for a given CFI Range
 * @param  {EpubCFI} cfiRange a epub cfi range
 * @return {Promise}
 */
export function getRange(cfiRange) {
	var cfi = new EpubCFI(cfiRange);
	var item = this.spine.get(cfi.spinePos);
	if (!item) {
		return new Promise((resolve, reject) => {
			reject("CFI could not be found");
		});
	}
	return this.spineLoader.load(item).then(function () {
		var range = cfi.toRange(item.document);
		return range;
	});
}

/**
 * Search the book for a string
 * @param {string} query
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.maxResults]
 * @param {number} [options.maxSeqEle]
 * @param {boolean} [options.unload=true] unload sections after searching (skips pinned sections)
 * @param {function} [options.onProgress]
 * @return {Promise<Array<{sectionIndex: number, href: string, cfi: string, excerpt: string}>>}
 */
export async function search(query, options) {
	if (!query || typeof query !== "string") {
		return [];
	}

	query = query.trim();
	if (!query) {
		return [];
	}

	options = options || {};
	const signal = options.signal;
	const maxSeqEle =
		typeof options.maxSeqEle === "number" && options.maxSeqEle > 0
			? Math.floor(options.maxSeqEle)
			: undefined;
	const unload = options.unload !== false;
	const onProgress = typeof options.onProgress === "function" ? options.onProgress : undefined;

	let maxResults = Infinity;
	if (typeof options.maxResults === "number" && isFinite(options.maxResults) && options.maxResults >= 0) {
		maxResults = Math.floor(options.maxResults);
	}

	await this.ready;

	const sections = this.spine && this.spine.spineItems ? this.spine.spineItems : [];
	const total = sections.length;
	const results = [];

	for (let i = 0; i < sections.length; i += 1) {
		const section = sections[i];
		if (!section || !section.linear) {
			continue;
		}

		if (signal && signal.aborted) {
			throw {
				name: "AbortError",
				message: "Aborted",
			};
		}

		if (this.spineLoader) {
			await this.spineLoader.load(section, signal ? { signal } : undefined);
		} else {
			await section.load(signal ? (url) => this.load(url, undefined, undefined, undefined, { signal }) : this.load.bind(this));
		}

		const matches = maxSeqEle ? section.search(query, maxSeqEle) : section.search(query);
		for (const match of matches) {
			results.push({
				sectionIndex: section.index,
				href: section.href,
				cfi: match.cfi,
				excerpt: match.excerpt,
			});

			if (results.length >= maxResults) {
				break;
			}
		}

		if (onProgress) {
			onProgress({
				sectionIndex: section.index,
				href: section.href,
				processed: i + 1,
				total,
				results: results.length,
			});
		}

		if (unload && this.spineLoader && !this.spineLoader.isPinned(section) && typeof section.unload === "function") {
			section.unload();
		}

		if (results.length >= maxResults) {
			break;
		}
	}

	return results;
}

