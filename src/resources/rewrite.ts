import { XLINK_NS } from "./types";

async function replaceSeries(
	str: string,
	regex: RegExp,
	asyncReplacer: (...args: any[]) => Promise<string> | string
): Promise<string> {
	let result = "";
	let lastIndex = 0;
	let match;

	regex.lastIndex = 0;

	while ((match = regex.exec(str)) !== null) {
		result += str.slice(lastIndex, match.index);
		result += await asyncReplacer.apply(null, match);
		lastIndex = match.index + match[0].length;
	}

	result += str.slice(lastIndex);
	return result;
}

export async function replaceMarkup(
	markup: string,
	mediaType: SupportedType,
	baseUrl: string,
	parentKey: string,
	parents?: string[]
): Promise<string> {
	let doc = new DOMParser().parseFromString(markup, mediaType);

	if (doc.querySelector("parsererror") && mediaType !== "text/html") {
		doc = new DOMParser().parseFromString(markup, "text/html");
	}

	await this.replaceDocument(doc, baseUrl, parentKey, parents || []);

	return new XMLSerializer().serializeToString(doc);
}

export async function replaceDocument(doc: Document, baseUrl: string, parentKey: string, parents?: string[]): Promise<void> {
	const replaceAttribute = async (el, attr) => {
		const value = el.getAttribute(attr);
		const replaced = await this.loadHref(value, baseUrl, parentKey, parents);
		if (replaced && replaced !== value) {
			el.setAttribute(attr, replaced);
		}
	};

	for (const el of Array.from(doc.querySelectorAll("link[href]"))) {
		const rel = (el.getAttribute("rel") || "").toLowerCase();
		if (rel.split(/\\s+/).indexOf("stylesheet") === -1) {
			continue;
		}
		await replaceAttribute(el, "href");
	}

	for (const el of Array.from(doc.querySelectorAll("[src]"))) {
		await replaceAttribute(el, "src");
	}

	for (const el of Array.from(doc.querySelectorAll("[poster]"))) {
		await replaceAttribute(el, "poster");
	}

	for (const el of Array.from(doc.querySelectorAll("object[data]"))) {
		await replaceAttribute(el, "data");
	}

	for (const el of Array.from(doc.querySelectorAll("image[href], use[href]"))) {
		await replaceAttribute(el, "href");
	}

	for (const el of Array.from(doc.querySelectorAll("[*|href]:not([href])"))) {
		const value = el.getAttributeNS(XLINK_NS, "href");
		const replaced = await this.loadHref(value, baseUrl, parentKey, parents);
		if (replaced && replaced !== value) {
			el.setAttributeNS(XLINK_NS, "href", replaced);
		}
	}

	for (const el of Array.from(doc.querySelectorAll("[srcset]"))) {
		const value = el.getAttribute("srcset");
		if (!value) {
			continue;
		}
		const replaced = await this.replaceSrcset(value, baseUrl, parentKey, parents);
		if (replaced && replaced !== value) {
			el.setAttribute("srcset", replaced);
		}
	}

	for (const el of Array.from(doc.querySelectorAll("style"))) {
		if (!el.textContent) {
			continue;
		}
		el.textContent = await this.replaceCSS(el.textContent, baseUrl, parentKey, parents);
	}

	for (const el of Array.from(doc.querySelectorAll("[style]"))) {
		const value = el.getAttribute("style");
		if (!value) {
			continue;
		}
		el.setAttribute("style", await this.replaceCSS(value, baseUrl, parentKey, parents));
	}
}

export async function replaceSrcset(srcset: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
	const parts = srcset
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);

	const rewritten = [];

	for (const part of parts) {
		const segments = part.split(/\\s+/).filter(Boolean);
		const url = segments.shift();
		if (!url) {
			continue;
		}
		const replacedUrl = await this.loadHref(url, baseUrl, parentKey, parents);
		rewritten.push([replacedUrl].concat(segments).join(" "));
	}

	return rewritten.join(", ");
}

export async function replaceCSS(str: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
	const replacedUrls = await replaceSeries(
		str,
		/url\\(\\s*[\"']?([^'\"\\n]*?)\\s*[\"']?\\s*\\)/gi,
		(_, url) => this.loadHref(url, baseUrl, parentKey, parents).then((nextUrl) => `url(\"${nextUrl}\")`)
	);

	return replaceSeries(
		replacedUrls,
		/@import\\s*[\"']([^\"'\\n]*?)[\"']/gi,
		(_, url) => this.loadHref(url, baseUrl, parentKey, parents).then((nextUrl) => `@import \"${nextUrl}\"`)
	);
}

