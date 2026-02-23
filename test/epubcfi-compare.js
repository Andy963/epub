import assert from "assert";
import EpubCFI from "../src/epubcfi";

describe("EpubCFI.compare", function () {
	it("orders by spine position", function () {
		const cfi = new EpubCFI();
		const first = "epubcfi(/6/8!/4/2)";
		const second = "epubcfi(/6/10!/4/2)";

		assert.equal(cfi.compare(first, second), -1);
		assert.equal(cfi.compare(second, first), 1);
		assert.equal(cfi.compare(first, first), 0);
	});

	it("orders by path steps", function () {
		const cfi = new EpubCFI();
		const first = "epubcfi(/6/8!/4/2/6)";
		const second = "epubcfi(/6/8!/4/2/8)";

		assert.equal(cfi.compare(first, second), -1);
		assert.equal(cfi.compare(second, first), 1);
	});

	it("orders by terminal offset", function () {
		const cfi = new EpubCFI();
		const first = "epubcfi(/6/8!/4/2/6:10)";
		const second = "epubcfi(/6/8!/4/2/6:5)";

		assert.equal(cfi.compare(first, second), 1);
		assert.equal(cfi.compare(second, first), -1);
	});

	it("uses range start when comparing ranges", function () {
		const cfi = new EpubCFI();
		const first = "epubcfi(/6/8!/4/2,/3:0,/3:0)";
		const second = "epubcfi(/6/8!/4/2,/5:0,/5:0)";

		assert.equal(cfi.compare(first, second), -1);
		assert.equal(cfi.compare(second, first), 1);
	});
});

