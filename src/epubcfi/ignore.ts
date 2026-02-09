export type IgnoreClass = string | ((node: any) => boolean);

export function isIgnored(node: any, ignore: IgnoreClass | undefined) {
	if (!node || !ignore) {
		return false;
	}

	if (typeof ignore === "function") {
		try {
			return ignore(node) === true;
		} catch (e) {
			return false;
		}
	}

	if (typeof ignore === "string") {
		return Boolean(node.classList && node.classList.contains(ignore));
	}

	return false;
}

export function shouldUseIgnore(doc: any, ignore: IgnoreClass | undefined) {
	if (!ignore) {
		return false;
	}

	if (typeof ignore === "function") {
		return true;
	}

	if (typeof ignore === "string" && doc && typeof doc.querySelector === "function") {
		try {
			return doc.querySelector("." + ignore) != null;
		} catch (e) {
			return true;
		}
	}

	return Boolean(ignore);
}

