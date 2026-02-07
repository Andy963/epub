import assert from "assert";

import Navigation from "../src/navigation";
import PdfBook from "../src/pdf/book";

function createMockPdf(pages) {
	return {
		numPages: pages.length,
		getPage: (pageNumber) => {
			const index = Math.max(0, Math.min(pages.length - 1, pageNumber - 1));
			const text = pages[index];
			return Promise.resolve({
				getTextContent: () =>
					Promise.resolve({
						items: [{ str: text }],
					}),
			});
		},
	};
}

async function openMockBook(pages) {
	const book = new PdfBook({
		maxCachedTextPages: 0,
	});
	book.pdf = createMockPdf(pages);
	book.numPages = book.pdf.numPages;
	book.buildSpine();
	book.navigation = new Navigation([]);
	book.loading.metadata.resolve(book.package.metadata);
	book.loading.navigation.resolve(book.navigation);
	book.isOpen = true;
	book.opening.resolve(book);
	await book.ready;
	return book;
}

describe("PdfBook searchText", function () {
	it("should respect matchCase", async function () {
		const book = await openMockBook(["Hello World"]);

		const caseSensitive = await book.searchText("hello", { matchCase: true });
		assert.strictEqual(caseSensitive.length, 0);

		const caseInsensitive = await book.searchText("hello", { matchCase: false });
		assert.strictEqual(caseInsensitive.length, 1);
	});

	it("should respect matchDiacritics", async function () {
		const book = await openMockBook(["café"]);

		const ignoreDiacritics = await book.searchText("cafe", {
			matchDiacritics: false,
		});
		assert.strictEqual(ignoreDiacritics.length, 1);

		const strictDiacritics = await book.searchText("cafe", {
			matchDiacritics: true,
		});
		assert.strictEqual(strictDiacritics.length, 0);
	});

	it("should respect matchWholeWords", async function () {
		const book = await openMockBook(["hellos hello"]);

		const wholeWords = await book.searchText("hello", { matchWholeWords: true });
		assert.strictEqual(wholeWords.length, 1);
		assert.strictEqual(wholeWords[0].matches.length, 1);
	});
});

describe("PdfBook search", function () {
	it("should return page-level CFIs", async function () {
		const book = await openMockBook(["Hello World"]);
		const results = await book.search("hello", { matchCase: false, maxResults: 1 });
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].cfi, "epubcfi(/2/2[page-1])");
	});
});
