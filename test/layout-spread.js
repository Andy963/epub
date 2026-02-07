import assert from "assert";

import Layout from "../src/layout";

describe("Layout", function () {
	it("should disable spreads with spread:false", function () {
		const layout = new Layout({
			layout: "pre-paginated",
			spread: false,
			minSpreadWidth: 0,
			evenSpreads: false,
			flow: "paginated",
		});

		layout.calculate(1200, 800, 0);
		assert.strictEqual(layout.divisor, 1);
	});
});

