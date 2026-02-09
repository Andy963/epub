import assert from "assert";
import EventEmitter from "event-emitter";
import { createSpeechHighlighter } from "../src/speech-highlighter";
import { speechAnchorFromRange, speechAnchorToRange } from "../src/read-aloud";

describe("SpeechHighlighter", function () {
	it("highlights a segment and preserves anchor resolution with ignore predicate", async function () {
		const base = "/6/2[cover]";
		const contents = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body><p id="p">Hello world</p></body></html>';
		const doc = new DOMParser().parseFromString(contents, "application/xhtml+xml");

		const textNode = doc.getElementById("p").firstChild;
		const range = doc.createRange();
		range.setStart(textNode, 2);
		range.setEnd(textNode, 5);

		const rendition = {
			settings: { ignoreClass: "" },
			getContents: () => [{ sectionIndex: 0, document: doc }],
			display: async () => {},
		};
		EventEmitter(rendition);

		const hl = createSpeechHighlighter(rendition, { className: "my-read-aloud-hl", scroll: false });
		const anchor = speechAnchorFromRange(range, base, hl.ignore);

		await hl.highlight({ spineIndex: 0, href: "chapter.xhtml", anchor, text: "llo" }, { scroll: false });

		const wrappers = doc.querySelectorAll('[data-epubjs-speech-hl="1"]');
		assert.ok(wrappers.length > 0);

		const restored = speechAnchorToRange(anchor, doc, hl.ignore);
		assert.strictEqual(restored.toString(), "llo");
		const anchor2 = speechAnchorFromRange(restored, base, hl.ignore);
		assert.strictEqual(anchor2, anchor);

		hl.stop();
		assert.strictEqual(doc.querySelectorAll('[data-epubjs-speech-hl="1"]').length, 0);
	});

	it("re-applies highlight on rendition re-render (navigation / reflow)", async function () {
		const base = "/6/2[cover]";
		const markup = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body><p id="p">Hello world</p></body></html>';
		const doc1 = new DOMParser().parseFromString(markup, "application/xhtml+xml");

		const textNode = doc1.getElementById("p").firstChild;
		const range = doc1.createRange();
		range.setStart(textNode, 0);
		range.setEnd(textNode, 5);

		let currentDoc = doc1;
		const rendition = {
			settings: { ignoreClass: "" },
			getContents: () => [{ sectionIndex: 0, document: currentDoc }],
			display: async () => {},
		};
		EventEmitter(rendition);

		const hl = createSpeechHighlighter(rendition, { className: "my-read-aloud-hl", scroll: false });
		const anchor = speechAnchorFromRange(range, base, hl.ignore);

		await hl.highlight({ spineIndex: 0, href: "chapter.xhtml", anchor, text: "Hello" }, { scroll: false });
		assert.strictEqual(doc1.querySelectorAll('[data-epubjs-speech-hl="1"]').length > 0, true);

		const doc2 = new DOMParser().parseFromString(markup, "application/xhtml+xml");
		currentDoc = doc2;

		const view = { index: 0, contents: { document: doc2 }, settings: {} };
		rendition.emit("rendered", {}, view);

		assert.strictEqual(doc2.querySelectorAll('[data-epubjs-speech-hl="1"]').length > 0, true);
		hl.stop();
	});

	it("calls rendition.display when scroll is enabled", async function () {
		const base = "/6/2[cover]";
		const contents = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body><p id="p">Hello world</p></body></html>';
		const doc = new DOMParser().parseFromString(contents, "application/xhtml+xml");

		const textNode = doc.getElementById("p").firstChild;
		const range = doc.createRange();
		range.setStart(textNode, 0);
		range.setEnd(textNode, 5);

		let called = 0;
		let lastTarget = null;
		const rendition = {
			settings: { ignoreClass: "" },
			getContents: () => [{ sectionIndex: 0, document: doc }],
			display: async (target) => {
				called += 1;
				lastTarget = target;
			},
		};
		EventEmitter(rendition);

		const hl = createSpeechHighlighter(rendition, { className: "my-read-aloud-hl", scroll: true });
		const anchor = speechAnchorFromRange(range, base, hl.ignore);

		await hl.highlight({ spineIndex: 0, href: "chapter.xhtml", anchor, text: "Hello" }, { scroll: true });

		assert.strictEqual(called > 0, true);
		assert.strictEqual(lastTarget, anchor);
		hl.stop();
	});
});
