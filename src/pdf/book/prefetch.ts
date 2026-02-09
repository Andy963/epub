export function cancelPrefetch() {
	const baseVersion =
		typeof this.prefetchVersion === "number" && isFinite(this.prefetchVersion)
			? this.prefetchVersion
			: 0;
	this.prefetchVersion = baseVersion + 1;
	if (this.prefetchController) {
		try {
			this.prefetchController.abort();
		} catch (e) {
			// NOOP
		}
		this.prefetchController = undefined;
	}

	if (this.prefetchParentKey && this.pageCache) {
		try {
			this.pageCache.releaseParent(this.prefetchParentKey);
		} catch (e) {
			// NOOP
		}
	}
	this.prefetchParentKey = undefined;

	return this.prefetchVersion;
}

export function prefetch(section, distance) {
	if (!section) {
		return Promise.resolve([]);
	}

	const resolvedDistance =
		typeof distance === "number" && distance > 0
			? Math.floor(distance)
			: typeof this.settings.prefetchDistance === "number" &&
				  this.settings.prefetchDistance > 0
				? Math.floor(this.settings.prefetchDistance)
				: 0;

	if (!resolvedDistance) {
		return Promise.resolve([]);
	}

	const candidates = this.collectPrefetchCandidates(section, resolvedDistance);
	if (!candidates.length) {
		return Promise.resolve([]);
	}

	if (!this.pageCache) {
		return Promise.resolve([]);
	}

	const prefetchVersion = this.cancelPrefetch();
	const controller =
		typeof AbortController !== "undefined" ? new AbortController() : undefined;
	this.prefetchController = controller;
	const parentKey = `prefetch:${prefetchVersion}`;
	this.prefetchParentKey = parentKey;

	const loadSequentially = (index, results) => {
		if (index >= candidates.length) {
			return Promise.resolve(results);
		}

		if (prefetchVersion !== this.prefetchVersion) {
			results.push(undefined);
			return loadSequentially(index + 1, results);
		}

		const candidate = candidates[index];
		const key = this.pageCacheKey(candidate.pageNumber);
		return this.pageCache
			.acquire(key, parentKey, () =>
				this.renderPageData(
					candidate.pageNumber,
					controller ? { signal: controller.signal } : undefined,
				),
			)
			.then((value) => {
				results.push(prefetchVersion === this.prefetchVersion ? value : undefined);
				return loadSequentially(index + 1, results);
			})
			.catch(() => {
				results.push(undefined);
				return loadSequentially(index + 1, results);
			});
	};

	return loadSequentially(0, [])
		.then((results) => {
			if (this.prefetchParentKey === parentKey) {
				this.prefetchParentKey = undefined;
				try {
					this.pageCache.releaseParent(parentKey);
				} catch (e) {
					// NOOP
				}
			}
			if (this.prefetchController === controller) {
				this.prefetchController = undefined;
			}
			return results;
		})
		.catch((error) => {
			if (this.prefetchParentKey === parentKey) {
				this.prefetchParentKey = undefined;
				try {
					this.pageCache.releaseParent(parentKey);
				} catch (e) {
					// NOOP
				}
			}
			if (this.prefetchController === controller) {
				this.prefetchController = undefined;
			}
			throw error;
		});
}

export function collectPrefetchCandidates(section, distance) {
	const candidates = [];
	let next = section;
	let prev = section;

	for (let i = 0; i < distance; i += 1) {
		next = next && typeof next.next === "function" ? next.next() : undefined;
		if (next) {
			candidates.push(next);
		}

		prev = prev && typeof prev.prev === "function" ? prev.prev() : undefined;
		if (prev) {
			candidates.push(prev);
		}
	}

	return candidates;
}

