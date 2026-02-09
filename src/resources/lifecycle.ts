export function destroy(): void {
	this.resourceCache && this.resourceCache.clear();
	this.resourceCache = undefined;
	this.resolvedManifest = undefined;
	if (this.replacementUrls && this.replacementUrls.length) {
		this.replacementUrls.forEach((url) => {
			if (url && typeof url === "string" && url.indexOf("blob:") === 0) {
				try {
					URL.revokeObjectURL(url);
				} catch (e) {
					// NOOP
				}
			}
		});
	}
	this.settings = undefined;
	this.manifest = undefined;
	this.resources = undefined;
	this.replacementUrls = undefined;
	this.html = undefined;
	this.assets = undefined;
	this.css = undefined;

	this.urls = undefined;
	this.cssUrls = undefined;
}

