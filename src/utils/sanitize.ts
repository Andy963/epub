const XLINK_NS = "http://www.w3.org/1999/xlink";

type UnsafeUrlOptions = {
	allowData?: boolean;
};

function normalizeForSchemeCheck(value: string): string {
	const trimmed = value.trim();
	let out = "";
	for (let i = 0; i < trimmed.length; i++) {
		const code = trimmed.charCodeAt(i);
		if (code <= 0x20) {
			continue;
		}
		if (code >= 0x7f && code <= 0x9f) {
			continue;
		}
		out += trimmed[i];
	}
	return out.toLowerCase();
}

function getScheme(value: string): string | undefined {
	const normalized = normalizeForSchemeCheck(value);
	const match = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
	return match && match[1] ? match[1].toLowerCase() : undefined;
}

export function isUnsafeUrl(value: string, options?: UnsafeUrlOptions): boolean {
	if (!value || typeof value !== "string") {
		return false;
	}

	const trimmed = value.trim();
	if (!trimmed || trimmed.indexOf("#") === 0) {
		return false;
	}

	const scheme = getScheme(trimmed);
	if (!scheme) {
		return false;
	}

	if (scheme === "javascript" || scheme === "vbscript") {
		return true;
	}

	if (scheme === "data") {
		return !(options && options.allowData);
	}

	return false;
}

function removeAll(nodes: NodeListOf<Element>): void {
	for (const el of Array.from(nodes)) {
		if (el.parentNode) {
			el.parentNode.removeChild(el);
		}
	}
}

export function sanitizeDocument(doc: Document): void {
	if (!doc || typeof (doc as any).querySelectorAll !== "function") {
		return;
	}

	removeAll(doc.querySelectorAll("script, iframe, object, embed"));

	for (const el of Array.from(doc.querySelectorAll("*"))) {
		for (const attr of Array.from(el.attributes || [])) {
			if (/^on/i.test(attr.name)) {
				el.removeAttribute(attr.name);
			}
		}

		const href = el.getAttribute("href");
		if (href && isUnsafeUrl(href)) {
			el.removeAttribute("href");
		}

		const src = el.getAttribute("src");
		if (src && isUnsafeUrl(src, { allowData: true })) {
			el.removeAttribute("src");
		}

		const poster = el.getAttribute("poster");
		if (poster && isUnsafeUrl(poster, { allowData: true })) {
			el.removeAttribute("poster");
		}

		const data = el.getAttribute("data");
		if (data && isUnsafeUrl(data, { allowData: true })) {
			el.removeAttribute("data");
		}

		const srcset = el.getAttribute("srcset");
		if (srcset) {
			const parts = srcset
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean);

			const rewritten = [];
			for (const part of parts) {
				const segments = part.split(/\s+/).filter(Boolean);
				const url = segments.shift();
				if (!url || isUnsafeUrl(url, { allowData: true })) {
					continue;
				}
				rewritten.push([url].concat(segments).join(" "));
			}

			if (rewritten.length) {
				el.setAttribute("srcset", rewritten.join(", "));
			} else {
				el.removeAttribute("srcset");
			}
		}

		if (typeof el.getAttributeNS === "function") {
			const xlinkHref = el.getAttributeNS(XLINK_NS, "href");
			if (xlinkHref && isUnsafeUrl(xlinkHref)) {
				el.removeAttributeNS(XLINK_NS, "href");
			}
		}
	}
}
