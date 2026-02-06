import assert from "assert";
import Book from "../src/book";
import PerformanceTracker from "../src/utils/performance";

describe("PerformanceTracker", function () {
	it("records spans, marks and counters", function () {
		let clock = 0;
		const tracker = new PerformanceTracker({
			now: () => {
				clock += 10;
				return clock;
			}
		});

		const span = tracker.start("phase.load", {
			id: "chapter-1"
		});
		tracker.mark("phase.ready");
		tracker.end(span, {
			status: "ok"
		});

		const snapshot = tracker.snapshot();
		assert.equal(snapshot.entries.length, 2);
		assert.equal(snapshot.entries[0].type, "mark");
		assert.equal(snapshot.entries[1].type, "span");
		assert.equal(snapshot.entries[1].duration, 20);
		assert.equal(snapshot.counters["phase.load.count"], 1);
		assert.equal(snapshot.counters["phase.ready.count"], 1);
	});

	it("returns empty entries when disabled", function () {
		const tracker = new PerformanceTracker(false);
		const span = tracker.start("phase.load");
		tracker.mark("phase.ready");
		tracker.end(span);

		const snapshot = tracker.snapshot();
		assert.equal(snapshot.enabled, false);
		assert.equal(snapshot.entries.length, 0);
		assert.equal(Object.keys(snapshot.counters).length, 0);
	});
});

	describe("Book performance metrics", function () {
		it("captures open and load metrics", async function () {
		let clock = 0;
		const book = new Book("/fixtures/alice/OPS/package.opf", {
			metrics: {
				now: () => {
					clock += 5;
					return clock;
				}
			}
		});

		await book.opened;
		const snapshot = book.getPerformanceSnapshot();

		assert(snapshot.entries.some((entry) => entry.type === "span" && entry.name === "book.open"));
		assert(snapshot.entries.some((entry) => entry.type === "span" && entry.name === "book.load"));
		assert(snapshot.entries.some((entry) => entry.type === "mark" && entry.name === "book.ready"));
			assert(snapshot.counters["book.load.count"] >= 1);
		});

		it("is disabled by default", async function () {
			const book = new Book("/fixtures/alice/OPS/package.opf");
			await book.opened;

			const snapshot = book.getPerformanceSnapshot();
			assert.equal(snapshot.enabled, false);
			assert.equal(snapshot.entries.length, 0);
			assert.equal(Object.keys(snapshot.counters).length, 0);
		});

		it("respects disabled metric collection", async function () {
			const book = new Book("/fixtures/alice/OPS/package.opf", {
				metrics: false
			});
		await book.opened;

		const snapshot = book.getPerformanceSnapshot();
		assert.equal(snapshot.enabled, false);
		assert.equal(snapshot.entries.length, 0);
		assert.equal(Object.keys(snapshot.counters).length, 0);
	});


	it("captures prefetch metrics", async function () {
		let clock = 0;
		const book = new Book("/fixtures/alice/OPS/package.opf", {
			metrics: {
				now: () => {
					clock += 3;
					return clock;
				}
			}
		});

		await book.opened;
		await book.prefetch(book.section(0), 1);
		const snapshot = book.getPerformanceSnapshot();

		assert(snapshot.entries.some((entry) => entry.type === "span" && entry.name === "book.prefetch"));
		assert(snapshot.entries.some((entry) => entry.type === "span" && entry.name === "spine.prefetch"));
		assert(snapshot.counters["book.prefetch.count"] >= 1);
	});
});
