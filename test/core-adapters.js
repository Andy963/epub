import assert from "assert";
import ResourceResolver from "../src/core/resource-resolver";
import SpineLoader from "../src/core/spine-loader";
import PerformanceTracker from "../src/utils/performance";

describe("ResourceResolver", function () {
	it("uses remote request when unarchived", async function () {
		const calls = [];
		const resolver = new ResourceResolver({
			resolvePath: (path) => `/book/${path}`,
			isArchived: () => false,
			requestArchive: () => Promise.resolve("archive"),
			requestRemote: (resolved, type, credentials, headers) => {
				calls.push({ resolved, type, credentials, headers });
				return Promise.resolve("remote");
			},
			requestCredentials: () => true,
			requestHeaders: () => ({
				"x-test": "value"
			})
		});

		const result = await resolver.load("chapter-1.xhtml");
		assert.equal(result, "remote");
		assert.equal(calls.length, 1);
		assert.equal(calls[0].resolved, "/book/chapter-1.xhtml");
		assert.equal(calls[0].type, null);
		assert.equal(calls[0].credentials, true);
		assert.equal(calls[0].headers["x-test"], "value");
	});

	it("uses archive request when archived", async function () {
		const archiveCalls = [];
		const resolver = new ResourceResolver({
			resolvePath: (path) => `/book/${path}`,
			isArchived: () => true,
			requestArchive: (resolved) => {
				archiveCalls.push(resolved);
				return Promise.resolve("archive");
			},
			requestRemote: () => Promise.resolve("remote"),
			requestCredentials: () => undefined,
			requestHeaders: () => undefined
		});

		const result = await resolver.load("chapter-2.xhtml");
		assert.equal(result, "archive");
		assert.equal(archiveCalls.length, 1);
		assert.equal(archiveCalls[0], "/book/chapter-2.xhtml");
	});

	it("records load metrics", async function () {
		const tracker = new PerformanceTracker({
			now: (() => {
				let now = 0;
				return () => {
					now += 1;
					return now;
				};
			})()
		});
		const resolver = new ResourceResolver({
			resolvePath: (path) => path,
			isArchived: () => false,
			requestArchive: () => Promise.resolve("archive"),
			requestRemote: () => Promise.resolve("remote"),
			requestCredentials: () => undefined,
			requestHeaders: () => undefined,
			performance: tracker
		});

		await resolver.load("chapter-3.xhtml");
		const snapshot = tracker.snapshot();
		assert.equal(snapshot.counters["book.load.count"], 1);
		assert(snapshot.entries.some((entry) => entry.type === "span" && entry.name === "book.load"));
	});
});

	describe("SpineLoader", function () {
	it("loads section through provided loader", async function () {
		const calls = [];
		const loader = new SpineLoader({
			loadResource: (url) => {
				calls.push(url);
				return Promise.resolve(`<doc>${url}</doc>`);
			}
		});
		const section = {
			index: 7,
			href: "chapter-7.xhtml",
			load: (requestSection) => requestSection("chapter-7.xhtml")
		};

		const result = await loader.load(section);
		assert.equal(result, "<doc>chapter-7.xhtml</doc>");
		assert.equal(calls.length, 1);
		assert.equal(calls[0], "chapter-7.xhtml");
	});

	it("prefetches neighbor sections", async function () {
		const loaded = [];
		const loader = new SpineLoader({
			loadResource: () => Promise.resolve("ignored")
		});

		const previous = {
			index: 1,
			href: "previous.xhtml",
			load: () => {
				loaded.push("previous");
				return Promise.resolve("previous");
			},
			prev: () => undefined,
			next: () => undefined
		};
		const next = {
			index: 3,
			href: "next.xhtml",
			load: () => {
				loaded.push("next");
				return Promise.resolve("next");
			},
			prev: () => undefined,
			next: () => undefined
		};
		const center = {
			index: 2,
			href: "center.xhtml",
			load: () => Promise.resolve("center"),
			prev: () => previous,
			next: () => next
		};

		await loader.prefetch(center, 1);
		loaded.sort();
		assert.deepEqual(loaded, ["next", "previous"]);
	});

		it("invalidates stale prefetch results when superseded", async function () {
		let resolveDelayed;
		const delayed = new Promise((resolve) => {
			resolveDelayed = resolve;
		});
		const loader = new SpineLoader({
			loadResource: () => Promise.resolve("ignored")
		});

		const staleNeighbor = {
			index: 4,
			href: "stale.xhtml",
			load: () => delayed,
			prev: () => undefined,
			next: () => undefined
		};
		const freshNeighbor = {
			index: 8,
			href: "fresh.xhtml",
			load: () => Promise.resolve("fresh"),
			prev: () => undefined,
			next: () => undefined
		};

		const firstCenter = {
			index: 3,
			href: "center-a.xhtml",
			load: () => Promise.resolve("center-a"),
			prev: () => undefined,
			next: () => staleNeighbor
		};
		const secondCenter = {
			index: 7,
			href: "center-b.xhtml",
			load: () => Promise.resolve("center-b"),
			prev: () => undefined,
			next: () => freshNeighbor
		};

		const stalePrefetch = loader.prefetch(firstCenter, 1);
		const freshPrefetch = loader.prefetch(secondCenter, 1);
		resolveDelayed("stale");

		const staleResults = await stalePrefetch;
		const freshResults = await freshPrefetch;
			assert.equal(staleResults.filter(Boolean).length, 0);
			assert.equal(freshResults.filter(Boolean).length, 1);
		});

		it("evicts unpinned sections beyond budget", async function () {
			const unloaded = [];
			const loader = new SpineLoader({
				loadResource: () => Promise.resolve("ignored"),
				maxLoadedSections: 2
			});

			const makeSection = (index) => {
				return {
					index,
					href: `chapter-${index}.xhtml`,
					load: () => Promise.resolve(`loaded-${index}`),
					unload: () => unloaded.push(index)
				};
			};

			await loader.load(makeSection(1));
			await loader.load(makeSection(2));
			await loader.load(makeSection(3));

			assert.deepEqual(unloaded, [1]);
		});

		it("does not evict pinned sections", async function () {
			const unloaded = [];
			const loader = new SpineLoader({
				loadResource: () => Promise.resolve("ignored"),
				maxLoadedSections: 2
			});

			const makeSection = (index) => {
				return {
					index,
					href: `chapter-${index}.xhtml`,
					load: () => Promise.resolve(`loaded-${index}`),
					unload: () => unloaded.push(index)
				};
			};

			const pinned = makeSection(1);
			loader.pin(pinned);

			await loader.load(makeSection(2));
			await loader.load(makeSection(3));

			assert.deepEqual(unloaded, [2]);
		});
	});
