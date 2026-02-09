import PdfSection from "../section";

export function hrefFromPageIndex(pageIndex) {
	const index =
		typeof pageIndex === "number" && isFinite(pageIndex) ? Math.floor(pageIndex) : 0;
	const section =
		this.spine && typeof this.spine.get === "function" ? this.spine.get(index) : undefined;
	return section ? section.href : `page-${index + 1}`;
}

export function buildSpine() {
	if (!this.pdf) {
		return;
	}

	this.spine.spineItems = [];
	this.spine.spineByHref = {};
	this.spine.spineById = {};

	for (let page = 1; page <= this.pdf.numPages; page += 1) {
		const section = new PdfSection(this, page);
		this.spine.append(section);
	}

	this.spine.length = this.spine.spineItems.length;
	this.spine.loaded = true;
}

