export async function buildTextLayerHtml(textContent, viewport) {
	const viewer = this.pdfjsViewer();
	const pdfjs = this.pdfjsLib();
	const renderTextLayer =
		(viewer && typeof viewer.renderTextLayer === "function"
			? viewer.renderTextLayer
			: undefined) ||
		(pdfjs && typeof pdfjs.renderTextLayer === "function"
			? pdfjs.renderTextLayer
			: undefined);

	if (renderTextLayer) {
		try {
			const container = document.createElement("div");
			container.className = "textLayer";

			const task = renderTextLayer({
				textContent,
				container,
				viewport,
				textDivs: [],
				textContentItemsStr: [],
				enhanceTextSelection: true,
			});

			if (task && task.promise && typeof task.promise.then === "function") {
				await task.promise;
			} else if (task && typeof task.then === "function") {
				await task;
			}

			const end = document.createElement("div");
			end.className = "endOfContent";
			container.appendChild(end);

			return container.outerHTML;
		} catch (e) {
			// Fallback to a minimal, self-contained HTML layer
		}
	}

	const items =
		textContent && Array.isArray(textContent.items) ? textContent.items : [];
	const transform =
		pdfjs && pdfjs.Util && typeof pdfjs.Util.transform === "function"
			? pdfjs.Util.transform
			: this.transformMatrix;

	const spans = [];

	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		if (!item) {
			continue;
		}

		const text = item.str;
		if (!text || typeof text !== "string") {
			continue;
		}

		const itemTransform = item.transform;
		if (!itemTransform || !Array.isArray(itemTransform)) {
			continue;
		}

		const tx = transform(viewport.transform, itemTransform);
		const angle = Math.atan2(tx[1], tx[0]);
		const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
		if (!fontHeight || !isFinite(fontHeight)) {
			continue;
		}

		const xScale = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
		const scaleX = xScale && isFinite(xScale) ? xScale / fontHeight : 1;
		const left = tx[4];
		const top = tx[5] - fontHeight;

		if (!isFinite(left) || !isFinite(top)) {
			continue;
		}

		const style = [
			`left:${left}px`,
			`top:${top}px`,
			`font-size:${fontHeight}px`,
			`transform:rotate(${angle}rad) scaleX(${scaleX})`,
		].join(";");

		spans.push(`<span style=\"${style}\">${this.escapeHtml(text)}</span>`);
	}

	return `<div class=\"textLayer\">${spans.join("")}<div class=\"endOfContent\"></div></div>`;
}

export async function buildAnnotationLayerHtml(annotations, viewport, page) {
	const items = Array.isArray(annotations) ? annotations : [];

	const viewer = this.pdfjsViewer();
	const pdfjs = this.pdfjsLib();
	const AnnotationLayer =
		(viewer && viewer.AnnotationLayer) || (pdfjs && pdfjs.AnnotationLayer);

	if (
		AnnotationLayer &&
		typeof AnnotationLayer.render === "function" &&
		page &&
		typeof page.getViewport === "function"
	) {
		try {
			const toDestKey = (dest) => {
				if (!dest) {
					return;
				}
				if (typeof dest === "string") {
					return `name:${dest}`;
				}
				if (!Array.isArray(dest) || dest.length === 0) {
					return;
				}
				const ref = dest[0];
				if (typeof ref === "number" && isFinite(ref)) {
					return `page:${Math.floor(ref)}`;
				}
				if (
					ref &&
					typeof ref === "object" &&
					typeof ref.num === "number" &&
					typeof ref.gen === "number"
				) {
					return `ref:${ref.num}:${ref.gen}`;
				}
				try {
					return `json:${JSON.stringify(dest)}`;
				} catch (e) {
					return;
				}
			};

			const destToHref = new Map();
			for (let i = 0; i < items.length; i += 1) {
				const item = items[i];
				if (!item || !item.dest) {
					continue;
				}

				const key = toDestKey(item.dest);
				if (!key || destToHref.has(key)) {
					continue;
				}

				const index = await this.resolveDestToPageIndex(item.dest);
				if (typeof index === "number") {
					destToHref.set(key, this.hrefFromPageIndex(index));
				}
			}

			const linkService = {
				getDestinationHash: (dest) => {
					const key = toDestKey(dest);
					const href = key ? destToHref.get(key) : undefined;
					return href || "";
				},
				navigateTo: () => {
					// Navigation is handled by epub.js link interception
				},
				getAnchorUrl: (anchor) => anchor,
				setHash: () => {
					// NOOP
				},
			};

			const div = document.createElement("div");
			div.className = "annotationLayer";

			const task = AnnotationLayer.render({
				annotations: items,
				div,
				page,
				viewport,
				linkService,
				renderForms: false,
			});

			if (task && task.promise && typeof task.promise.then === "function") {
				await task.promise;
			} else if (task && typeof task.then === "function") {
				await task;
			}

			if (!div.children || div.children.length === 0) {
				return "";
			}

			return div.outerHTML;
		} catch (e) {
			// Fallback to a minimal, self-contained HTML layer
		}
	}

	const links = [];

	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		if (!item || item.subtype !== "Link") {
			continue;
		}

		const rect = item.rect;
		if (!rect || !Array.isArray(rect) || rect.length !== 4) {
			continue;
		}

		let href = undefined;
		if (
			(item.url && typeof item.url === "string") ||
			(item.unsafeUrl && typeof item.unsafeUrl === "string")
		) {
			href = item.url || item.unsafeUrl;
		} else if (item.dest) {
			const index = await this.resolveDestToPageIndex(item.dest);
			if (typeof index === "number") {
				href = this.hrefFromPageIndex(index);
			}
		}

		if (!href) {
			continue;
		}

		const points = viewport.convertToViewportRectangle(rect);
		if (!points || points.length !== 4) {
			continue;
		}

		const left = Math.min(points[0], points[2]);
		const top = Math.min(points[1], points[3]);
		const width = Math.abs(points[0] - points[2]);
		const height = Math.abs(points[1] - points[3]);

		if (!isFinite(left) || !isFinite(top) || !isFinite(width) || !isFinite(height)) {
			continue;
		}

		const style = [
			`left:${left}px`,
			`top:${top}px`,
			`width:${width}px`,
			`height:${height}px`,
		].join(";");

		links.push(`<a href=\"${this.escapeHtml(href)}\" style=\"${style}\"></a>`);
	}

	if (links.length === 0) {
		return "";
	}

	return `<div class=\"annotationLayer\">${links.join("")}</div>`;
}

