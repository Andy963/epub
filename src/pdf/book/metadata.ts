import { extend } from "../../utils/core";

/**
 * Get a cover image URL (renders the first page)
 * @return {Promise<?string>} coverUrl
 */
export async function coverUrl() {
	await this.ready;

	if (!this.pdf || !this.pageCache) {
		return null;
	}

	const parentKey = "cover";
	const key = this.pageCacheKey(1);
	const pageData = await this.pageCache.acquire(key, parentKey, async () => {
		return this.renderPageData(1);
	});

	return pageData && pageData.url ? pageData.url : null;
}

export async function loadMetadata() {
	if (!this.pdf || typeof this.pdf.getMetadata !== "function") {
		this.loading.metadata.resolve(
			this.package && this.package.metadata ? this.package.metadata : {},
		);
		return;
	}

	try {
		const data = await this.pdf.getMetadata();
		const info = data && data.info ? data.info : {};
		const xmp =
			data && data.metadata && typeof data.metadata.get === "function"
				? data.metadata
				: undefined;
		const getXmp = (key) => {
			if (!xmp) {
				return;
			}
			try {
				const value = xmp.get(key);
				if (typeof value === "undefined" || value === null) {
					return;
				}
				if (typeof value === "string") {
					return value;
				}
				if (Array.isArray(value)) {
					return value.filter(Boolean).join(", ");
				}
				return value.toString ? value.toString() : String(value);
			} catch (e) {
				return;
			}
		};
		const metadata = extend(
			this.package && this.package.metadata ? this.package.metadata : {},
			{
				title: (getXmp("dc:title") || info.Title || info.title || "").toString(),
				creator: (getXmp("dc:creator") || info.Author || info.author || "").toString(),
				contributor: getXmp("dc:contributor"),
				description: (getXmp("dc:description") || info.Subject || info.subject || "").toString(),
				language: (getXmp("dc:language") || "").toString(),
				publisher: (getXmp("dc:publisher") || "").toString(),
				subject: (getXmp("dc:subject") || "").toString(),
				identifier: (getXmp("dc:identifier") || "").toString(),
				source: (getXmp("dc:source") || "").toString(),
				rights: (getXmp("dc:rights") || "").toString(),
			},
		);

		if (this.package) {
			this.package.metadata = metadata;
		}

		this.loading.metadata.resolve(metadata);
	} catch (error) {
		this.loading.metadata.resolve(
			this.package && this.package.metadata ? this.package.metadata : {},
		);
	}
}

