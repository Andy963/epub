import assert from "assert";
import Rendition from "../src/rendition";

describe("Rendition prefetch integration", function () {
	it("cancels stale prefetch before a new display", async function () {
		const section = { index: 1, href: "chapter-1.xhtml" };
		let cancelled = 0;

		const fakeRendition = {
			epubcfi: {
				isCfiString() {
					return false;
				}
			},
			book: {
				cancelPrefetch() {
					cancelled += 1;
				},
				locations: {
					length() {
						return 0;
					}
				},
				spine: {
					get(target) {
						if (target === "chapter-1.xhtml") {
							return section;
						}
					}
				}
			},
			manager: {
				display() {
					return Promise.resolve();
				}
			},
			emit() {
				return;
			},
			reportLocation() {
				return;
			}
		};

		await Rendition.prototype._display.call(fakeRendition, "chapter-1.xhtml");
		assert.equal(cancelled, 1);
	});

	it("prefetches neighbors after rendering when enabled", function (done) {
		const section = { index: 2, href: "chapter-2.xhtml" };
		let seenPrefetch;
		const fakeRendition = {
			book: {
				prefetch(currentSection, distance) {
					seenPrefetch = { currentSection, distance };
					return Promise.resolve([]);
				}
			},
			settings: {
				prefetch: 2
			},
			hooks: {
				render: {
					trigger() {
						return Promise.resolve();
					}
				},
				content: {
					trigger() {
						return Promise.resolve();
					}
				}
			},
			emit(type, emittedSection) {
				if (type === "rendered") {
					assert.equal(emittedSection, section);
					setTimeout(() => {
						assert.equal(seenPrefetch.currentSection, section);
						assert.equal(seenPrefetch.distance, 2);
						done();
					}, 0);
				}
			},
			triggerMarkEvent() {
				return;
			}
		};

		const view = {
			section,
			contents: {},
			on() {
				return;
			}
		};

		Rendition.prototype.afterDisplayed.call(fakeRendition, view);
	});
});
