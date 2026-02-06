import assert from "assert";

import SpineLoader from "../src/core/spine-loader";

describe("SpineLoader abort", function () {
	it("should abort in-flight prefetch loads", async function () {
		const calls = [];
		const loadResource = (url, type, withCredentials, headers, options) => {
			calls.push({ url, options });
			return new Promise((resolve, reject) => {
				const signal = options && options.signal;
				if (signal) {
					signal.addEventListener(
						"abort",
						() => {
							reject({
								name: "AbortError",
								message: "Aborted"
							});
						},
						{ once: true }
					);
				}
			});
		};

		const loader = new SpineLoader({
			loadResource
		});

		const nextSection = {
			index: 1,
			href: "next.xhtml",
			url: "/next.xhtml",
			load: (request) => request("/next.xhtml")
		};

		const rootSection = {
			index: 0,
			href: "root.xhtml",
			url: "/root.xhtml",
			load: (request) => request("/root.xhtml"),
			next: () => nextSection,
			prev: () => undefined
		};

		nextSection.next = () => undefined;
		nextSection.prev = () => rootSection;

		const prefetching = loader.prefetch(rootSection, 1);
		loader.cancelPrefetch();

		const results = await prefetching;
		assert.equal(results.length, 1, "should prefetch one neighbor");
		assert.equal(results[0], undefined, "should ignore aborted load");
		assert.equal(calls.length, 1, "should start one load");
		assert(calls[0].options && calls[0].options.signal, "should pass abort signal");
		assert.equal(calls[0].options.signal.aborted, true, "signal should be aborted");
	});
});

