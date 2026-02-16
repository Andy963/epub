import assert from "assert";
import Locations from "../src/locations";
import PageList from "../src/pagelist";

describe("EpubCFI comparator binding", function () {
	it("binds Locations.locationFromCfi comparator (no this loss)", function () {
		const locations = new Locations();
		locations.load([
			"epubcfi(/6/2[chap01]!/4/2/14)",
			"epubcfi(/6/2[chap01]!/4/2/16)",
			"epubcfi(/6/2[chap01]!/4/2/18)",
		]);

		assert.doesNotThrow(() =>
			locations.locationFromCfi("epubcfi(/6/2[chap01]!/4/2/14)")
		);
		assert.equal(locations.locationFromCfi("epubcfi(/6/2[chap01]!/4/2/14)"), 0);
	});

	it("binds PageList.pageFromCfi comparator (no this loss)", function () {
		const pageList = new PageList();
		pageList.pages = [1, 2, 3];
		pageList.locations = [
			"epubcfi(/6/2[chap01]!/4/2/14)",
			"epubcfi(/6/2[chap01]!/4/2/16)",
			"epubcfi(/6/2[chap01]!/4/2/18)",
		];
		pageList.firstPage = 1;
		pageList.lastPage = 3;
		pageList.totalPages = 2;

		assert.doesNotThrow(() =>
			pageList.pageFromCfi("epubcfi(/6/2[chap01]!/4/2/16)")
		);
		assert.equal(pageList.pageFromCfi("epubcfi(/6/2[chap01]!/4/2/16)"), 2);
	});
});

