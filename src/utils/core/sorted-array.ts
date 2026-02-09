/**
 * Fast quicksort insert for sorted array -- based on:
 *  http://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
 * @param {any} item
 * @param {array} array
 * @param {function} [compareFunction]
 * @returns {number} location (in array)
 * @memberof Core
 */
export function insert(item, array, compareFunction) {
	var location = locationOf(item, array, compareFunction);
	array.splice(location, 0, item);

	return location;
}

/**
 * Finds where something would fit into a sorted array
 * @param {any} item
 * @param {array} array
 * @param {function} [compareFunction]
 * @param {function} [_start]
 * @param {function} [_end]
 * @returns {number} location (in array)
 * @memberof Core
 */
export function locationOf(item, array, compareFunction, _start?, _end?) {
	var start = _start || 0;
	var end = _end || array.length;
	var pivot = parseInt(start + (end - start) / 2);
	var compared;
	if (!compareFunction) {
		compareFunction = function (a, b) {
			if (a > b) return 1;
			if (a < b) return -1;
			if (a == b) return 0;
		};
	}
	if (end - start <= 0) {
		return pivot;
	}

	compared = compareFunction(array[pivot], item);
	if (end - start === 1) {
		return compared >= 0 ? pivot : pivot + 1;
	}
	if (compared === 0) {
		return pivot;
	}
	if (compared === -1) {
		return locationOf(item, array, compareFunction, pivot, end);
	} else {
		return locationOf(item, array, compareFunction, start, pivot);
	}
}

/**
 * Finds index of something in a sorted array
 * Returns -1 if not found
 * @param {any} item
 * @param {array} array
 * @param {function} [compareFunction]
 * @param {function} [_start]
 * @param {function} [_end]
 * @returns {number} index (in array) or -1
 * @memberof Core
 */
export function indexOfSorted(item, array, compareFunction, _start?, _end?) {
	var start = _start || 0;
	var end = _end || array.length;
	var pivot = parseInt(start + (end - start) / 2);
	var compared;
	if (!compareFunction) {
		compareFunction = function (a, b) {
			if (a > b) return 1;
			if (a < b) return -1;
			if (a == b) return 0;
		};
	}
	if (end - start <= 0) {
		return -1; // Not found
	}

	compared = compareFunction(array[pivot], item);
	if (end - start === 1) {
		return compared === 0 ? pivot : -1;
	}
	if (compared === 0) {
		return pivot; // Found
	}
	if (compared === -1) {
		return indexOfSorted(item, array, compareFunction, pivot, end);
	} else {
		return indexOfSorted(item, array, compareFunction, start, pivot);
	}
}

