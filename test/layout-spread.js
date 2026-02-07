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

	it("should honor maxColumnCount=1 even when spread is enabled", function () {
		const layout = new Layout({
			layout: "reflowable",
			spread: true,
			minSpreadWidth: 800,
			evenSpreads: false,
			flow: "paginated",
		});

		layout.calculate(1200, 800, 0, 1);
		assert.strictEqual(layout.divisor, 1);
	});

	it("should support maxColumnCount > 2 for wide screens", function () {
		const layout = new Layout({
			layout: "reflowable",
			spread: true,
			minSpreadWidth: 800,
			evenSpreads: false,
			flow: "paginated",
		});

		layout.calculate(1600, 800, 40, 4);
		assert.strictEqual(layout.divisor, 4);
	});
});
