/**
 * @param {any} n
 * @returns {boolean}
 * @memberof Core
 */
export function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * @param {any} n
 * @returns {boolean}
 * @memberof Core
 */
export function isFloat(n) {
	let f = parseFloat(n);

	if (isNumber(n) === false) {
		return false;
	}

	if (typeof n === "string" && n.indexOf(".") > -1) {
		return true;
	}

	return Math.floor(f) !== f;
}

