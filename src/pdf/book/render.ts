export async function renderPage(pageNumber, parentKey) {
	if (!this.pdf) {
		throw new Error("PDF is not open");
	}

	const key = this.pageCacheKey(pageNumber);
	const pageData = await this.pageCache.acquire(key, parentKey, async () => {
		return this.renderPageData(pageNumber);
	});

	const style = [
		"html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }",
		"body { position: relative; background: transparent; }",
		".page { position: relative; width: 100%; height: 100%; }",
		".page img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }",
		".textLayer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; color: transparent; -webkit-text-fill-color: transparent; font-family: sans-serif; transform-origin: 0 0; line-height: 1; text-size-adjust: none; z-index: 2; }",
		".textLayer span { position: absolute; white-space: pre; transform-origin: 0 0; line-height: 1; cursor: text; }",
		".textLayer ::selection { background: rgba(0, 0, 255, 0.25); }",
		".textLayer .endOfContent { display: block; position: absolute; inset: 100% 0 0; z-index: 0; cursor: default; user-select: none; }",
		".textLayer.selecting .endOfContent { top: 0; }",
		".annotationLayer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 3; }",
		".annotationLayer a { position: absolute; display: block; pointer-events: auto; }",
	].join("\n");

	const layers = [
		`<img src=\"${pageData.url}\" alt=\"Page ${pageNumber}\" />`,
		pageData.textLayer || "",
		pageData.annotationLayer || "",
	].join("");

	return [
		"<!DOCTYPE html>",
		'<html lang="en">',
		"<head>",
		'<meta charset="utf-8" />',
		`<meta name=\"viewport\" content=\"width=${pageData.width}, height=${pageData.height}\" />`,
		`<style>${style}</style>`,
		"</head>",
		"<body>",
		`<div class=\"page\">${layers}</div>`,
		"</body>",
		"</html>",
	].join("");
}

export function pageCacheKey(pageNumber, renderScale?, options?) {
	const page =
		typeof pageNumber === "number" && isFinite(pageNumber) ? Math.floor(pageNumber) : 1;
	const resolvedScale =
		typeof renderScale === "number" && isFinite(renderScale) && renderScale > 0
			? renderScale
			: typeof this.settings.renderScale === "number" &&
				  isFinite(this.settings.renderScale) &&
				  this.settings.renderScale > 0
				? this.settings.renderScale
				: 1;
	const scale = Math.round(resolvedScale * 1000) / 1000;

	const includeTextLayer =
		options && typeof options.textLayer === "boolean"
			? options.textLayer
			: this.settings.textLayer;
	const includeAnnotationLayer =
		options && typeof options.annotationLayer === "boolean"
			? options.annotationLayer
			: this.settings.annotationLayer;

	const textLayer = includeTextLayer ? "text:1" : "text:0";
	const annotationLayer = includeAnnotationLayer ? "ann:1" : "ann:0";
	return `page:${page}|render:${scale}|${textLayer}|${annotationLayer}`;
}

export async function renderPageData(pageNumber, options?) {
	const signal = options && options.signal;
	if (signal && signal.aborted) {
		throw {
			name: "AbortError",
			message: "Aborted",
		};
	}

	const pageIndex =
		typeof pageNumber === "number" && isFinite(pageNumber) ? Math.floor(pageNumber) : 1;
	const page = await this.pdf.getPage(pageIndex);
	const resolvedScale =
		options &&
		typeof options.renderScale === "number" &&
		isFinite(options.renderScale) &&
		options.renderScale > 0
			? options.renderScale
			: typeof this.settings.renderScale === "number" &&
				  isFinite(this.settings.renderScale) &&
				  this.settings.renderScale > 0
				? this.settings.renderScale
				: 1;
	const includeTextLayer =
		options && typeof options.textLayer === "boolean"
			? options.textLayer
			: this.settings.textLayer;
	const includeAnnotationLayer =
		options && typeof options.annotationLayer === "boolean"
			? options.annotationLayer
			: this.settings.annotationLayer;
	const deviceScale =
		typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
	const cssViewport = page.getViewport({ scale: 1 });
	this.recordPageWeight(pageIndex - 1, cssViewport);
	const viewport = page.getViewport({ scale: resolvedScale * deviceScale });

	const canvas = document.createElement("canvas");
	canvas.width = Math.floor(viewport.width);
	canvas.height = Math.floor(viewport.height);

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("CanvasRenderingContext2D is not available");
	}

	const renderTask = page.render({
		canvasContext: ctx,
		viewport,
	});

	let aborted = false;
	const onAbort = () => {
		aborted = true;
		try {
			renderTask.cancel();
		} catch (e) {
			// NOOP
		}
	};

	if (signal) {
		if (signal.aborted) {
			onAbort();
		} else {
			signal.addEventListener("abort", onAbort, { once: true });
		}
	}

	try {
		await renderTask.promise;
	} catch (error) {
		if (
			aborted ||
			(error && typeof error === "object" && error.name === "RenderingCancelledException")
		) {
			throw {
				name: "AbortError",
				message: "Aborted",
			};
		}
		throw error;
	} finally {
		if (signal) {
			try {
				signal.removeEventListener("abort", onAbort);
			} catch (e) {
				// NOOP
			}
		}
	}

	const blob = await new Promise((resolve, reject) => {
		canvas.toBlob((result) => {
			if (!result) {
				reject(new Error("Failed to render page"));
				return;
			}
			resolve(result);
		});
	});

	const url = URL.createObjectURL(blob);

	if (signal && signal.aborted) {
		URL.revokeObjectURL(url);
		throw {
			name: "AbortError",
			message: "Aborted",
		};
	}

	let textLayer = "";
	if (includeTextLayer) {
		try {
			if (signal && signal.aborted) {
				URL.revokeObjectURL(url);
				throw {
					name: "AbortError",
					message: "Aborted",
				};
			}
			const textContent = await page.getTextContent();
			if (signal && signal.aborted) {
				URL.revokeObjectURL(url);
				throw {
					name: "AbortError",
					message: "Aborted",
				};
			}
			textLayer = await this.buildTextLayerHtml(textContent, cssViewport);
		} catch (e) {
			if (e && typeof e === "object" && e.name === "AbortError") {
				throw e;
			}
			textLayer = "";
		}
	}

	let annotationLayer = "";
	if (includeAnnotationLayer) {
		try {
			if (signal && signal.aborted) {
				URL.revokeObjectURL(url);
				throw {
					name: "AbortError",
					message: "Aborted",
				};
			}
			const annotations = await page.getAnnotations({ intent: "display" });
			if (signal && signal.aborted) {
				URL.revokeObjectURL(url);
				throw {
					name: "AbortError",
					message: "Aborted",
				};
			}
			annotationLayer = await this.buildAnnotationLayerHtml(annotations, cssViewport, page);
		} catch (e) {
			if (e && typeof e === "object" && e.name === "AbortError") {
				throw e;
			}
			annotationLayer = "";
		}
	}

	return {
		url,
		width: cssViewport.width,
		height: cssViewport.height,
		textLayer,
		annotationLayer,
	};
}

