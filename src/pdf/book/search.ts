/**
 * Search the PDF for a string (returns results with page-level CFIs)
 * @param {string} query
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.maxResults]
 * @param {number} [options.excerptLimit]
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
	const localesOverride = options.locales;
	const matchCase = options.matchCase === true;
	const matchDiacritics = options.matchDiacritics === true;
	const matchWholeWords = options.matchWholeWords === true;
	const excerptLimit =
		typeof options.excerptLimit === "number" && options.excerptLimit > 0
			? Math.floor(options.excerptLimit)
			: 150;
	const onProgress =
		typeof options.onProgress === "function" ? options.onProgress : undefined;

	let maxResults = Infinity;
	if (
		typeof options.maxResults === "number" &&
		isFinite(options.maxResults) &&
		options.maxResults >= 0
	) {
		maxResults = Math.floor(options.maxResults);
	}

	await this.ready;

	const sections = this.spine && this.spine.spineItems ? this.spine.spineItems : [];
	const total = sections.length;
	const results = [];

	const locales =
		localesOverride ||
		(this.package &&
		this.package.metadata &&
		typeof this.package.metadata.language === "string" &&
		this.package.metadata.language
			? this.package.metadata.language
			: "en");

	const toLocaleLower = (value) => {
		if (matchCase) {
			return value;
		}
		try {
			return value.toLocaleLowerCase(locales);
		} catch (e) {
			return value.toLowerCase();
		}
	};

	const normalizeWhitespace = (value) => {
		return value.replace(/\s+/g, " ");
	};

	const makeExcerpt = (text, startOffset, endOffset) => {
		const half = Math.floor(excerptLimit / 2);
		const start = Math.max(0, startOffset - half);
		const end = Math.min(text.length, endOffset + half);
		let excerpt = normalizeWhitespace(text.slice(start, end)).trim();
		if (start > 0) {
			excerpt = "..." + excerpt;
		}
		if (end < text.length) {
			excerpt = excerpt + "...";
		}
		return excerpt;
	};

	const sensitivity =
		matchDiacritics && matchCase
			? "variant"
			: matchDiacritics && !matchCase
				? "accent"
				: !matchDiacritics && matchCase
					? "case"
					: "base";
	const granularity = matchWholeWords ? "word" : "grapheme";

	let segmenter;
	let collator;
	const IntlAny = Intl as any;
	if (typeof Intl !== "undefined" && IntlAny.Segmenter && IntlAny.Collator) {
		try {
			segmenter = new IntlAny.Segmenter(locales, {
				usage: "search",
				granularity,
			});
			collator = new IntlAny.Collator(locales, { sensitivity });
		} catch (e) {
			try {
				segmenter = new IntlAny.Segmenter("en", {
					usage: "search",
					granularity,
				});
				collator = new IntlAny.Collator("en", { sensitivity });
			} catch (e2) {
				segmenter = undefined;
				collator = undefined;
			}
		}
	}

	let nonFormattingRegex;
	try {
		nonFormattingRegex = new RegExp("[^\\p{Format}]", "u");
	} catch (e) {
		nonFormattingRegex = undefined;
	}

	const findMatches = (text) => {
		const matches = [];
		const shouldUseSegmenter =
			!!(segmenter && collator) &&
			!(
				granularity === "grapheme" &&
				(sensitivity === "variant" || sensitivity === "accent")
			);

		const searchSimple = () => {
			const haystack = toLocaleLower(text);
			const needle = toLocaleLower(query);
			let lastIndex = 0;

			while (matches.length < maxResults && lastIndex <= haystack.length) {
				const index = haystack.indexOf(needle, lastIndex);
				if (index === -1) {
					break;
				}

				matches.push({
					index,
					excerpt: makeExcerpt(text, index, index + needle.length),
				});
				lastIndex = index + needle.length;
			}
		};

		const searchSegmenter = () => {
			const queryLength = Array.from(segmenter.segment(query)).length;
			if (!queryLength) {
				return;
			}

			const substrArr = [];
			const segments = segmenter.segment(text)[Symbol.iterator]();

			const isFormatting = (segment) => {
				if (!nonFormattingRegex) {
					return false;
				}
				return !nonFormattingRegex.test(segment);
			};

			while (matches.length < maxResults) {
				while (substrArr.length < queryLength) {
					const next = segments.next();
					if (next.done) {
						return;
					}
					const value = next.value;
					if (!value) {
						continue;
					}

					const segment = value.segment;
					if (!segment || isFormatting(segment)) {
						continue;
					}

					if (/\s/u.test(segment)) {
						const last = substrArr[substrArr.length - 1];
						if (!last || !/\s/u.test(last.segment)) {
							substrArr.push({ index: value.index, segment: " " });
						}
						continue;
					}

					substrArr.push({ index: value.index, segment });
				}

				const substr = substrArr.map((part) => part.segment).join("");
				if (collator.compare(query, substr) === 0) {
					const startOffset = substrArr[0].index;
					const lastSeg = substrArr[substrArr.length - 1];
					const endOffset = lastSeg.index + lastSeg.segment.length;
					matches.push({
						index: startOffset,
						excerpt: makeExcerpt(text, startOffset, endOffset),
					});
				}

				substrArr.shift();
			}
		};

		if (shouldUseSegmenter) {
			searchSegmenter();
		} else {
			searchSimple();
		}

		return matches;
	};

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

		const text = await this.getPageText(section.pageNumber);
		const matches = findMatches(text);
		for (const match of matches) {
			results.push({
				sectionIndex: section.index,
				href: section.href,
				cfi: `epubcfi(${section.cfiBase})`,
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

		if (results.length >= maxResults) {
			break;
		}
	}

	return results;
}

