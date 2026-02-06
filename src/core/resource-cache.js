class ResourceCache {
	constructor(options) {
		options = options || {};
		this.revoke = options.revoke || this.defaultRevoke;
		this.performance = options.performance;
		this.entries = new Map();
		this.children = new Map();
	}

	acquire(key, parentKey, create) {
		if (!key) {
			return Promise.resolve(key);
		}

		if (parentKey) {
			const parentChildren = this.children.get(parentKey) || new Set();
			if (parentChildren.has(key)) {
				const existing = this.entries.get(key);
				if (existing) {
					return existing.promise || Promise.resolve(existing.value);
				}
			} else {
				parentChildren.add(key);
				this.children.set(parentKey, parentChildren);
			}
		}

		const existing = this.entries.get(key);
		if (existing) {
			existing.refCount += 1;
			if (this.performance) {
				this.performance.count("resources.cache.hit", 1);
			}
			return existing.promise || Promise.resolve(existing.value);
		}

		if (this.performance) {
			this.performance.count("resources.cache.miss", 1);
		}

		const entry = {
			value: undefined,
			promise: undefined,
			refCount: 1,
			released: false
		};

		entry.promise = Promise.resolve()
			.then(() => create())
			.then((value) => {
				entry.value = value;
				entry.promise = undefined;
				if (entry.released) {
					this.finalize(key, entry);
				}
				return value;
			})
			.catch((error) => {
				entry.promise = undefined;
				entry.released = true;
				this.finalize(key, entry);
				throw error;
			});

		this.entries.set(key, entry);

		return entry.promise;
	}

	release(key) {
		const entry = this.entries.get(key);
		if (!entry) {
			return;
		}

		if (entry.refCount > 1) {
			entry.refCount -= 1;
			return;
		}

		entry.refCount = 0;
		this.releaseParent(key);

		if (entry.promise) {
			entry.released = true;
			return;
		}

		entry.released = true;
		this.finalize(key, entry);
	}

	releaseParent(parentKey) {
		const parentChildren = this.children.get(parentKey);
		if (!parentChildren) {
			return;
		}

		this.children.delete(parentKey);
		parentChildren.forEach((childKey) => {
			this.release(childKey);
		});
	}

	finalize(key, entry) {
		if (this.entries.get(key) !== entry) {
			return;
		}

		if (entry.refCount > 0) {
			return;
		}

		this.entries.delete(key);

		if (this.performance) {
			this.performance.count("resources.cache.evict", 1);
		}

		try {
			this.revoke(entry.value, key);
		} catch (e) {
			// NOOP
		}
	}

	defaultRevoke(value) {
		if (!value || typeof value !== "string") {
			return;
		}

		if (value.indexOf("blob:") === 0) {
			try {
				URL.revokeObjectURL(value);
			} catch (e) {
				// NOOP
			}
		}
	}

	clear() {
		this.children.clear();
		this.entries.forEach((entry, key) => {
			try {
				this.revoke(entry.value, key);
			} catch (e) {
				// NOOP
			}
		});
		this.entries.clear();
	}
}

export default ResourceCache;
