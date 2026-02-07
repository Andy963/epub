export interface ResourceCachePerformance {
	count(name: string, value?: number): void;
}

export interface ResourceCacheOptions<V = unknown> {
	revoke?: (value: V | undefined, key: string) => void;
	performance?: ResourceCachePerformance;
	retain?: boolean;
	maxEntries?: number;
}

interface ResourceCacheEntry<V> {
	value: V | undefined;
	promise: Promise<V> | undefined;
	refCount: number;
	released: boolean;
}

class ResourceCache<V = unknown> {
	private revoke: (value: V | undefined, key: string) => void;
	private performance?: ResourceCachePerformance;
	private retain: boolean;
	private maxEntries: number;
	private entries: Map<string, ResourceCacheEntry<V>>;
	private children: Map<string, Set<string>>;
	private unreferenced: Set<string>;
	private unreferencedOrder: string[];

	constructor(options?: ResourceCacheOptions<V>) {
		options = options || {};
		this.revoke = options.revoke || this.defaultRevoke.bind(this);
		this.performance = options.performance;
		this.retain = Boolean(options.retain);
		this.maxEntries = this.normalizeMaxEntries(options.maxEntries);
		this.entries = new Map();
		this.children = new Map();
		this.unreferenced = new Set();
		this.unreferencedOrder = [];
	}

	private normalizeMaxEntries(value: unknown): number {
		if (typeof value !== "number" || !isFinite(value) || value <= 0) {
			return 0;
		}
		return Math.floor(value);
	}

	acquire(
		key: string | undefined | null,
		parentKey: string | undefined,
		create: () => Promise<V> | V,
	): Promise<V | string | undefined | null> {
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
			const wasUnreferenced = existing.refCount === 0;
			existing.refCount += 1;
			if (wasUnreferenced) {
				this.markReferenced(key);
			}
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
		} as ResourceCacheEntry<V>;

		entry.promise = Promise.resolve()
			.then(() => create())
			.then((value) => {
				entry.value = value;
				entry.promise = undefined;
				if (entry.released) {
					this.finalize(key, entry);
				} else if (this.retain && entry.refCount === 0) {
					this.markUnreferenced(key);
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

	private markReferenced(key: string): void {
		if (!this.unreferenced.has(key)) {
			return;
		}

		this.unreferenced.delete(key);
		const index = this.unreferencedOrder.indexOf(key);
		if (index !== -1) {
			this.unreferencedOrder.splice(index, 1);
		}
	}

	private markUnreferenced(key: string): void {
		if (!this.retain || this.maxEntries === 0) {
			return;
		}

		if (this.unreferenced.has(key)) {
			return;
		}

		this.unreferenced.add(key);
		this.unreferencedOrder.push(key);
		this.evictUnreferenced();
	}

	private evictUnreferenced(): void {
		if (!this.retain || this.maxEntries === 0) {
			return;
		}

		let guard = 0;
		while (this.unreferenced.size > this.maxEntries && guard < 10000) {
			guard += 1;
			const key = this.unreferencedOrder.shift();
			if (typeof key === "undefined") {
				return;
			}

			if (!this.unreferenced.has(key)) {
				continue;
			}

			this.unreferenced.delete(key);

			const entry = this.entries.get(key);
			if (!entry) {
				continue;
			}

			if (entry.refCount > 0) {
				continue;
			}

			if (entry.promise) {
				entry.released = true;
				continue;
			}

			entry.released = true;
			this.releaseParent(key);
			this.finalize(key, entry);
		}
	}

	release(key: string): void {
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
			if (!this.retain || this.maxEntries === 0) {
				entry.released = true;
			} else {
				this.markUnreferenced(key);
			}
			return;
		}

		if (this.retain && this.maxEntries > 0) {
			this.markUnreferenced(key);
			return;
		}

		entry.released = true;
		this.finalize(key, entry);
	}

	private releaseParent(parentKey: string): void {
		const parentChildren = this.children.get(parentKey);
		if (!parentChildren) {
			return;
		}

		this.children.delete(parentKey);
		parentChildren.forEach((childKey) => {
			this.release(childKey);
		});
	}

	releaseChild(parentKey: string, childKey: string): void {
		const parentChildren = this.children.get(parentKey);
		if (!parentChildren) {
			return;
		}

		if (!parentChildren.has(childKey)) {
			return;
		}

		parentChildren.delete(childKey);
		if (parentChildren.size === 0) {
			this.children.delete(parentKey);
		} else {
			this.children.set(parentKey, parentChildren);
		}

		this.release(childKey);
	}

	private finalize(key: string, entry: ResourceCacheEntry<V>): void {
		if (this.entries.get(key) !== entry) {
			return;
		}

		if (entry.refCount > 0) {
			return;
		}

		this.markReferenced(key);
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

	private defaultRevoke(value: V | undefined): void {
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

	clear(): void {
		this.children.clear();
		this.unreferenced.clear();
		this.unreferencedOrder = [];
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
