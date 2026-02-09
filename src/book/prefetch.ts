/**
 * Prefetch neighboring sections for a target section
 * @param  {Section | string | number} target
 * @param  {number | boolean} [distance]
 * @return {Promise<Array<any>>}
 */
export function prefetch(target, distance) {
	if (!this.spineLoader) {
		return Promise.resolve([]);
	}

	let section = target;
	if (!section || typeof section.load !== "function") {
		section = this.spine.get(target);
	}

	if (!section) {
		return Promise.resolve([]);
	}

	if (distance === false) {
		return Promise.resolve([]);
	}

	let resolvedDistance = distance;
	if (resolvedDistance === true || typeof resolvedDistance === "undefined" || resolvedDistance === null) {
		resolvedDistance = this.settings.prefetchDistance;
	}

	if (typeof resolvedDistance !== "number" || resolvedDistance <= 0) {
		resolvedDistance = 1;
	}

	const span = this.performance.start("book.prefetch", {
		sectionIndex: section.index,
		href: section.href,
		distance: resolvedDistance,
	});

	return this.spineLoader
		.prefetch(section, resolvedDistance)
		.then((results) => {
			this.performance.end(span, {
				status: "resolved",
				loaded: results.filter(Boolean).length,
			});
			return results;
		})
		.catch((error) => {
			this.performance.end(span, {
				status: "rejected",
				error: error && error.message,
			});
			throw error;
		});
}

/**
 * Cancel active prefetch tasks
 */
export function cancelPrefetch() {
	if (!this.spineLoader) {
		return;
	}

	return this.spineLoader.cancelPrefetch();
}

export function pinSection(target) {
	if (!this.spineLoader || typeof this.spineLoader.pin !== "function") {
		return;
	}

	let section = target;
	if (!section || typeof section.load !== "function") {
		section = this.spine.get(target);
	}

	if (!section) {
		return;
	}

	this.spineLoader.pin(section);
}

export function unpinSection(target) {
	if (!this.spineLoader || typeof this.spineLoader.unpin !== "function") {
		return;
	}

	let section = target;
	if (!section || typeof section.load !== "function") {
		section = this.spine.get(target);
	}

	if (!section) {
		return;
	}

	this.spineLoader.unpin(section);
}

