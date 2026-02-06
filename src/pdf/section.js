class PdfSection {
	constructor(book, pageNumber) {
		this.book = book;
		this.pageNumber = pageNumber;

		this.idref = `page-${pageNumber}`;
		this.href = this.idref;
		this.url = this.href;
		this.canonical = this.href;

		this.linear = true;
		this.properties = [];

		this.index = undefined;
		this.cfiBase = book && book.epubcfi
			? book.epubcfi.generateChapterComponent(0, pageNumber - 1, this.idref)
			: "";

		this.document = undefined;
		this.contents = undefined;
		this.output = undefined;
	}

	next() {
		if (!this.book || !this.book.spine) {
			return;
		}
		return this.book.spine.get(this.index + 1);
	}

	prev() {
		if (!this.book || !this.book.spine) {
			return;
		}
		return this.book.spine.get(this.index - 1);
	}

	load() {
		return Promise.resolve();
	}

	render() {
		const parentKey = this._resourceParentKey || this.href;
		return this.book.renderPage(this.pageNumber, parentKey).then((html) => {
			this.output = html;
			return html;
		});
	}

	unload() {
		this.document = undefined;
		this.contents = undefined;
		this.output = undefined;
	}

	destroy() {
		this.unload();
		this.book = undefined;
		this.pageNumber = undefined;
		this.idref = undefined;
		this.href = undefined;
		this.url = undefined;
		this.canonical = undefined;
		this.linear = undefined;
		this.properties = undefined;
		this.index = undefined;
		this.cfiBase = undefined;
	}
}

export default PdfSection;

