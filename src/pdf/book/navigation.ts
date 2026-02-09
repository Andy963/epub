import Navigation from "../../navigation";

export async function loadNavigation() {
	if (!this.pdf || typeof this.pdf.getOutline !== "function") {
		this.navigation = new Navigation([]);
		this.loading.navigation.resolve(this.navigation);
		return;
	}

	try {
		const outline = await this.pdf.getOutline();
		const toc = outline ? await this.outlineToToc(outline) : [];
		this.navigation = new Navigation(toc);
		this.loading.navigation.resolve(this.navigation);
	} catch (error) {
		this.navigation = new Navigation([]);
		this.loading.navigation.resolve(this.navigation);
	}
}

export async function outlineToToc(outlineItems) {
	const toc = [];
	const items = Array.isArray(outlineItems) ? outlineItems : [];

	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		if (!item) {
			continue;
		}

		const title = (item.title || "").toString();
		const children = await this.outlineToToc(item.items || item.children || []);

		let href = undefined;
		if (item.dest) {
			const index = await this.resolveDestToPageIndex(item.dest);
			if (typeof index === "number") {
				href = this.hrefFromPageIndex(index);
			}
		}

		if (
			!href &&
			((item.url && typeof item.url === "string") ||
				(item.unsafeUrl && typeof item.unsafeUrl === "string"))
		) {
			href = item.url || item.unsafeUrl;
		}

		if (!href && children.length === 0) {
			continue;
		}

		toc.push({
			title: title || `Item ${i + 1}`,
			href,
			children,
		});
	}

	return toc;
}

export async function resolveDestToPageIndex(dest) {
	if (!this.pdf) {
		return;
	}

	let resolved = dest;
	if (typeof dest === "string" && typeof this.pdf.getDestination === "function") {
		try {
			resolved = await this.pdf.getDestination(dest);
		} catch (e) {
			return;
		}
	}

	if (!Array.isArray(resolved) || resolved.length === 0) {
		return;
	}

	const ref = resolved[0];
	if (typeof ref === "number" && isFinite(ref)) {
		return Math.max(0, Math.min(this.numPages - 1, Math.floor(ref)));
	}

	if (ref && typeof this.pdf.getPageIndex === "function") {
		try {
			const index = await this.pdf.getPageIndex(ref);
			if (typeof index === "number" && isFinite(index)) {
				return Math.max(0, Math.min(this.numPages - 1, Math.floor(index)));
			}
		} catch (e) {
			return;
		}
	}
}

