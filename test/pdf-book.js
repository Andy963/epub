import assert from "assert";

import ePub from "../src/epub";
import PdfBook from "../src/pdf/book";

describe("PdfBook", function () {
	it("should expose PdfBook factory", function () {
		const book = ePub.pdf();
		assert(book instanceof PdfBook);
	});

	it("should reject opening without pdfjsLib", async function () {
		const book = new PdfBook();
		let error;
		try {
			await book.open(new ArrayBuffer(0));
		} catch (e) {
			error = e;
		}
		assert(error);
		assert(/pdfjsLib/.test(error.message));
	});
});

