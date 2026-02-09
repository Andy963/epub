/**
 * Resolve a path to it's absolute position in the Book
 * @param  {string} path
 * @param  {boolean} [absolute] force resolving the full URL
 * @return {string}          the resolved path string
 */
export function resolve(path, absolute?) {
	if (!path) {
		return;
	}
	var resolved = path;
	var isAbsolute = path.indexOf("://") > -1;

	if (isAbsolute) {
		return path;
	}

	if (this.path) {
		resolved = this.path.resolve(path);
	}

	if (absolute != false && this.url) {
		resolved = this.url.resolve(resolved);
	}

	return resolved;
}

/**
 * Get a canonical link to a path
 * @param  {string} path
 * @return {string} the canonical path string
 */
export function canonical(path) {
	var url = path;

	if (!path) {
		return "";
	}

	if (this.settings.canonical) {
		url = this.settings.canonical(path);
	} else {
		url = this.resolve(path, true);
	}

	return url;
}

