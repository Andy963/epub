/**
 * Apply defaults to an object
 * @param {object} obj
 * @returns {object}
 * @memberof Core
 */
export function defaults(obj: any, ...sources: any[]): any {
	for (var i = 0, length = sources.length; i < length; i++) {
		var source = sources[i];
		for (var prop in source) {
			if (obj[prop] === void 0) obj[prop] = source[prop];
		}
	}
	return obj;
}

/**
 * Extend properties of an object
 * @param {object} target
 * @returns {object}
 * @memberof Core
 */
export function extend(target: any, ...sources: any[]) {
	sources.forEach(function (source) {
		if (!source) return;
		Object.getOwnPropertyNames(source).forEach(function (propName) {
			Object.defineProperty(
				target,
				propName,
				Object.getOwnPropertyDescriptor(source, propName)
			);
		});
	});
	return target;
}

/**
 * Get type of an object
 * @param {object} obj
 * @returns {string} type
 * @memberof Core
 */
export function type(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

