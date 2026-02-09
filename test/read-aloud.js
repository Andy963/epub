import assert from "assert";
import { speechAnchorFromRange, speechAnchorToRange, speechSegmentsFromDocument } from "../src/read-aloud";

if (typeof DOMParser === "undefined") {
	global.DOMParser = require("@xmldom/xmldom").DOMParser;
}

describe("ReadAloud anchors", function () {
	it("round-trips a range via anchor", function () {
		const base = "/6/2[cover]";
		const contents = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body><p id="p">Hello world</p></body></html>';
		const doc = new DOMParser().parseFromString(contents, "application/xhtml+xml");

		const textNode = doc.getElementById("p").firstChild;
		const range = doc.createRange();
		range.setStart(textNode, 0);
		range.setEnd(textNode, 5);

		const anchor = speechAnchorFromRange(range, base);
		const restored = speechAnchorToRange(anchor, doc);

		assert.ok(typeof anchor === "string" && anchor.startsWith("epubcfi("));
		assert.strictEqual(restored.toString(), range.toString());
	});

	it("restores anchors after injected highlight wrappers (ignore predicate)", function () {
		const base = "/6/2[cover]";
		const contents = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body><p id="p">Hello world</p></body></html>';
		const doc = new DOMParser().parseFromString(contents, "application/xhtml+xml");

		const ignoreInjectedNodes = (node) => {
			if (!node || node.nodeType !== Node.ELEMENT_NODE) {
				return false;
			}
			const el = node;
			return el.getAttribute && el.getAttribute("class") === "hl";
		};

		const textNode = doc.getElementById("p").firstChild;
		const range = doc.createRange();
		range.setStart(textNode, 2);
		range.setEnd(textNode, 5);

		const anchor = speechAnchorFromRange(range, base, ignoreInjectedNodes);

		const wrapper = doc.createElement("span");
		wrapper.setAttribute("class", "hl");
		range.surroundContents(wrapper);

		const restored = speechAnchorToRange(anchor, doc, ignoreInjectedNodes);
		assert.strictEqual(restored.toString(), "llo");
	});
});

describe("ReadAloud segmentation", function () {
	it("extracts sentence segments with anchors in reading order", function () {
		const base = "/6/2[cover]";
		const contents = [
			'<html xmlns="http://www.w3.org/1999/xhtml">',
			"<head><title>t</title></head>",
			"<body>",
			'<p id="p1">Hello world. How are you?</p>',
			'<p id="p2">Second paragraph. Third sentence.</p>',
			"</body>",
			"</html>",
		].join("");
		const doc = new DOMParser().parseFromString(contents, "application/xhtml+xml");

		const segments = speechSegmentsFromDocument(
			doc,
			{ spineIndex: 0, href: "chapter.xhtml", cfiBase: base },
			{ maxSentences: 1, maxChars: 1000 }
		);

			assert.strictEqual(segments.length, 4);

			const normalize = (value) => String(value || "")
				.replace(/(?:\u00ad|\u200b|\u200c|\u200d|\u2060|\ufeff)/g, "")
				.replace(/\s+/g, " ")
				.trim();

		for (const seg of segments) {
			assert.strictEqual(seg.spineIndex, 0);
			assert.strictEqual(seg.href, "chapter.xhtml");
			assert.ok(typeof seg.anchor === "string" && seg.anchor.startsWith("epubcfi("));
			assert.ok(typeof seg.text === "string" && seg.text.length > 0);

			const restored = speechAnchorToRange(seg.anchor, doc);
			assert.strictEqual(normalize(restored.toString()), seg.text);
		}
	});

	it("produces deterministic segments (anchors + text) across invocations", function () {
		const base = "/6/2[cover]";
		const contents = [
			'<html xmlns="http://www.w3.org/1999/xhtml">',
			"<head><title>t</title></head>",
			"<body>",
			'<p id="p1">Hello world. How are you?</p>',
			'<p id="p2">Second paragraph with <em>inline</em> nodes. Third sentence!</p>',
			'<div><p id="p3">Block in a div. Another one.</p></div>',
			"</body>",
			"</html>",
		].join("");

		const input = { spineIndex: 0, href: "chapter.xhtml", cfiBase: base };
		const options = { maxSentences: 1, maxChars: 1000, locales: "en" };

		const doc1 = new DOMParser().parseFromString(contents, "application/xhtml+xml");
		const doc2 = new DOMParser().parseFromString(contents, "application/xhtml+xml");

		const s1 = speechSegmentsFromDocument(doc1, input, options);
		const s2 = speechSegmentsFromDocument(doc1, input, options);
		const s3 = speechSegmentsFromDocument(doc2, input, options);

		assert.deepStrictEqual(s1, s2);
		assert.deepStrictEqual(s1, s3);
	});
});
