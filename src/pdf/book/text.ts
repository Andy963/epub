export async function getPageText(pageNumber) {
	if (!this.pdf) {
		throw new Error("PDF is not open");
	}

	const maxCachedTextPages =
		typeof this.settings.maxCachedTextPages === "number" &&
		isFinite(this.settings.maxCachedTextPages) &&
		this.settings.maxCachedTextPages >= 0
			? Math.floor(this.settings.maxCachedTextPages)
			: 0;

	const page =
		typeof pageNumber === "number" && isFinite(pageNumber) ? Math.floor(pageNumber) : 1;
	const cached = this.pageTextCache.get(page);
	if (cached) {
		if (maxCachedTextPages > 0 && !cached.promise) {
			this.pageTextCache.delete(page);
			this.pageTextCache.set(page, cached);
		}
		return cached.promise || cached.text;
	}

	const entry = {
		text: "",
		promise: undefined,
	};

	entry.promise = this.pdf
		.getPage(page)
		.then((pageObj) => pageObj.getTextContent())
		.then((textContent) => {
			const items = textContent && Array.isArray(textContent.items) ? textContent.items : [];
			const text = items
				.map((item) => {
					if (!item) {
						return "";
					}
					const str = item.str;
					return typeof str === "string" ? str : str ? String(str) : "";
				})
				.join(" ");

			entry.text = text;
			entry.promise = undefined;

			if (maxCachedTextPages <= 0) {
				this.pageTextCache.delete(page);
			}
			return text;
		})
		.catch((error) => {
			this.pageTextCache.delete(page);
			throw error;
		});

	this.pageTextCache.set(page, entry);

	if (maxCachedTextPages > 0) {
		let guard = 0;
		while (this.pageTextCache.size > maxCachedTextPages && guard < 10000) {
			guard += 1;
			const oldest = this.pageTextCache.keys().next();
			if (oldest.done) {
				break;
			}
			const oldestKey = oldest.value;
			const oldestEntry = this.pageTextCache.get(oldestKey);
			if (oldestEntry && oldestEntry.promise) {
				this.pageTextCache.delete(oldestKey);
				this.pageTextCache.set(oldestKey, oldestEntry);
				continue;
			}
			this.pageTextCache.delete(oldestKey);
		}
	}

	return entry.promise;
}

