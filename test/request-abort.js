import assert from "assert";

import request from "../src/utils/request";

describe("Request abort", function () {
	it("should reject when signal is already aborted", async function () {
		const controller = new AbortController();
		controller.abort();

		let error;
		try {
			await request(
				"/fixtures/alice/OPS/package.opf",
				"xml",
				false,
				{},
				{ signal: controller.signal }
			);
		} catch (err) {
			error = err;
		}

		assert(error, "should reject");
		assert.equal(error.name, "AbortError");
	});
});

