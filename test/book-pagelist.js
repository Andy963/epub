import assert from "assert";
import ePub from "../src/epub";
import PageList from "../src/pagelist";

describe("Book pageList", function () {
	it("resolves loaded.pageList after navigation loads", function () {
		const book = ePub("./fixtures/alice/", { width: 400, height: 400 });
		return book.ready
			.then(() => book.loaded.pageList)
			.then((pageList) => {
				assert(pageList instanceof PageList);
			});
	});
});

