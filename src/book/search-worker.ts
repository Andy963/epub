export function createSearchWorker() {
	const source = `
self.onmessage = function(event) {
	var data = event && event.data;
	if (!data) return;
	var query = (data.query || "").trim();
	var content = data.content || "";
	var maxResultsPerSection = data.maxResultsPerSection || 50;
	var excerptLimit = data.excerptLimit || 150;
	var locales = data.locales || "en";
	var matchCase = data.matchCase === true;
	var matchDiacritics = data.matchDiacritics === true;
	var matchWholeWords = data.matchWholeWords === true;

	var normalizeWhitespace = function(value) {
		return String(value || "").replace(/\\s+/g, " ");
	};

	var makeExcerpt = function(text, startOffset, endOffset) {
		var half = Math.floor(excerptLimit / 2);
		var start = Math.max(0, startOffset - half);
		var end = Math.min(text.length, endOffset + half);
		var excerpt = normalizeWhitespace(text.slice(start, end)).trim();
		if (start > 0) excerpt = "..." + excerpt;
		if (end < text.length) excerpt = excerpt + "...";
		return excerpt;
	};

	var toLocaleLower = function(value) {
		if (matchCase) {
			return value;
		}
		try {
			return value.toLocaleLowerCase(locales);
		} catch (e) {
			return value.toLowerCase();
		}
	};

	var sensitivity = matchDiacritics && matchCase ? "variant"
		: matchDiacritics && !matchCase ? "accent"
		: !matchDiacritics && matchCase ? "case"
		: "base";
	var granularity = matchWholeWords ? "word" : "grapheme";

	if (!query) {
		self.postMessage({
			id: data.id,
			matches: []
		});
		return;
	}

	var matches = [];
	var segmenter;
	var collator;
	try {
		if (self.Intl && Intl.Segmenter && Intl.Collator) {
			segmenter = new Intl.Segmenter(locales, { usage: "search", granularity: granularity });
			collator = new Intl.Collator(locales, { sensitivity: sensitivity });
		}
	} catch (e) {
		segmenter = null;
		collator = null;
	}

	var nonFormattingRegex;
	try {
		nonFormattingRegex = new RegExp("[^\\\\p{Format}]", "u");
	} catch (e) {
		nonFormattingRegex = null;
	}

	var isFormatting = function(segment) {
		if (!nonFormattingRegex) {
			return false;
		}
		return !nonFormattingRegex.test(segment);
	};

	var shouldUseSegmenter = !!(segmenter && collator) &&
		!(granularity === "grapheme" && (sensitivity === "variant" || sensitivity === "accent"));

	if (shouldUseSegmenter) {
		var querySegments = Array.from(segmenter.segment(query));
		var queryLength = querySegments.length;
		if (queryLength) {
			var substrArr = [];
			var segments = segmenter.segment(content)[Symbol.iterator]();

			while (matches.length < maxResultsPerSection) {
				while (substrArr.length < queryLength) {
					var next = segments.next();
					if (next.done) {
						substrArr = null;
						break;
					}
					var value = next.value;
					if (!value) continue;
					var segment = value.segment;
					if (!segment || isFormatting(segment)) continue;
					if (/\\s/u.test(segment)) {
						var last = substrArr[substrArr.length - 1];
						if (!last || !/\\s/u.test(last.segment)) {
							substrArr.push({ index: value.index, segment: " " });
						}
						continue;
					}
					substrArr.push({ index: value.index, segment: segment });
				}

				if (!substrArr) break;

				var substr = substrArr.map(function(part) { return part.segment; }).join("");
				if (collator.compare(query, substr) === 0) {
					var startOffset = substrArr[0].index;
					var lastSeg = substrArr[substrArr.length - 1];
					var endOffset = lastSeg.index + lastSeg.segment.length;
					matches.push({ index: startOffset, excerpt: makeExcerpt(content, startOffset, endOffset) });
				}
				substrArr.shift();
			}
		}
	} else {
		var haystack = toLocaleLower(content);
		var needle = toLocaleLower(query);
		var needleLength = needle.length;
		var lastIndex = 0;
		while (matches.length < maxResultsPerSection) {
			var index = haystack.indexOf(needle, lastIndex);
			if (index === -1) break;
			matches.push({ index: index, excerpt: makeExcerpt(content, index, index + needleLength) });
			lastIndex = index + needleLength;
		}
	}

	self.postMessage({
		id: data.id,
		matches: matches
	});
};
`;

	const blob = new Blob([source], { type: "application/javascript" });
	const url = URL.createObjectURL(blob);
	const worker = new Worker(url);
	URL.revokeObjectURL(url);
	return worker;
}
