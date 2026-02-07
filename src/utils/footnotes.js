const EPUB_TYPE_NS = "http://www.idpf.org/2007/ops";

function splitTokens(value) {
	if (!value || typeof value !== "string") {
		return new Set();
	}
	return new Set(value.split(/\s+/).filter(Boolean));
}

export function getEpubTypes(element) {
	if (!element) {
		return new Set();
	}

	let raw;
	try {
		raw = element.getAttributeNS && element.getAttributeNS(EPUB_TYPE_NS, "type");
	} catch (e) {
		raw = undefined;
	}

	if (!raw && typeof element.getAttribute === "function") {
		raw = element.getAttribute("epub:type");
	}

	return splitTokens(raw);
}

export function getRoles(element) {
	if (!element || typeof element.getAttribute !== "function") {
		return new Set();
	}
	return splitTokens(element.getAttribute("role"));
}

export function isSuperscript(element, win) {
	if (!element) {
		return false;
	}

	if (typeof element.matches === "function" && element.matches("sup")) {
		return true;
	}

	if (!win || typeof win.getComputedStyle !== "function") {
		return false;
	}

	const style = win.getComputedStyle(element);
	const verticalAlign = style && style.verticalAlign;
	if (!verticalAlign) {
		return false;
	}

	return verticalAlign === "super" ||
		verticalAlign === "top" ||
		verticalAlign === "text-top" ||
		/^\d/.test(verticalAlign);
}

const REF_TYPES = ["biblioref", "glossref", "noteref"];
const REF_ROLES = ["doc-biblioref", "doc-glossref", "doc-noteref"];

export function classifyFootnoteReference(anchor, win) {
	const types = getEpubTypes(anchor);
	const roles = getRoles(anchor);

	const yes = REF_ROLES.some((role) => roles.has(role)) || REF_TYPES.some((type) => types.has(type));

	const maybe = () => {
		if (types.has("backlink") || roles.has("doc-backlink")) {
			return false;
		}

		if (isSuperscript(anchor, win)) {
			return true;
		}

		if (anchor && anchor.children && anchor.children.length === 1 && isSuperscript(anchor.children[0], win)) {
			return true;
		}

		if (anchor && anchor.parentElement && isSuperscript(anchor.parentElement, win)) {
			return true;
		}

		return false;
	};

	return { yes, maybe };
}

export function getReferencedType(element) {
	const types = getEpubTypes(element);
	const roles = getRoles(element);

	if (roles.has("doc-biblioentry") || types.has("biblioentry")) {
		return "biblioentry";
	}
	if (roles.has("definition") || types.has("glossdef")) {
		return "definition";
	}
	if (roles.has("doc-endnote") || types.has("endnote") || types.has("rearnote")) {
		return "endnote";
	}
	if (roles.has("doc-footnote") || types.has("footnote")) {
		return "footnote";
	}
	if (roles.has("note") || types.has("note")) {
		return "note";
	}

	return null;
}

const INLINE_SELECTOR = "a, span, sup, sub, em, strong, i, b, small, big";

export function extractFootnoteTarget(doc, anchor) {
	let element = anchor(doc);
	const target = element;

	while (element && typeof element.matches === "function" && element.matches(INLINE_SELECTOR)) {
		const parent = element.parentElement;
		if (!parent) {
			break;
		}
		element = parent;
	}

	if (element === doc.body) {
		const sibling = target && target.nextElementSibling;
		if (sibling && typeof sibling.matches === "function" && !sibling.matches(INLINE_SELECTOR)) {
			return sibling;
		}
		throw new Error("Failed to extract footnote");
	}

	return element;
}

