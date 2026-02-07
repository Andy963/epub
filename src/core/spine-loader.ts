export interface SpineLoaderPerformance {
	start(name: string, data?: Record<string, unknown>): unknown;
	end(span: unknown, data?: Record<string, unknown>): void;
	count(name: string, value?: number): void;
	mark(name: string, data?: Record<string, unknown>): void;
}

export interface SpineLoaderLoadOptions {
	signal?: AbortSignal;
	[key: string]: unknown;
}

export type SpineLoaderResourceRequest = (
	url: string,
	type?: string | null,
	withCredentials?: unknown,
	headers?: unknown,
	options?: SpineLoaderLoadOptions,
) => Promise<unknown>;

export type SpineLoaderSectionRequest = (
	url: string,
	type?: string | null,
	withCredentials?: unknown,
	headers?: unknown,
) => Promise<unknown>;

export interface SpineLoaderSection {
	index: number | string;
	href?: string;
	contents?: unknown;
	load: (request: SpineLoaderSectionRequest) => Promise<unknown>;
	unload?: () => void;
	next?: () => SpineLoaderSection | undefined;
	prev?: () => SpineLoaderSection | undefined;
}

export interface SpineLoaderOptions {
	loadResource: SpineLoaderResourceRequest;
	performance?: SpineLoaderPerformance;
	maxLoadedSections?: number | boolean;
}

class SpineLoader {
	private loadResource: SpineLoaderResourceRequest;
	private performance?: SpineLoaderPerformance;
	private prefetchVersion: number;
	private prefetchController: AbortController | undefined;
	private maxLoadedSections: number;
	private pinnedSections: Map<number, number>;
	private loadedSections: Map<number, SpineLoaderSection>;
	private loadedOrder: number[];

	constructor(options: SpineLoaderOptions) {
		options = options || ({} as SpineLoaderOptions);
		this.loadResource = options.loadResource;
		this.performance = options.performance;
		this.prefetchVersion = 0;
		this.prefetchController = undefined;
		this.maxLoadedSections = this.normalizeMaxLoadedSections(options.maxLoadedSections);
		this.pinnedSections = new Map();
		this.loadedSections = new Map();
		this.loadedOrder = [];
	}

	load(section: SpineLoaderSection, options?: SpineLoaderLoadOptions): Promise<unknown> {
		if (!section) {
			return Promise.reject(new Error("Section is required"));
		}

		const cacheHit = section && section.contents;
		const span = this.performance && this.performance.start("spine.load", {
			index: section.index,
			href: section.href
		});

		const request: SpineLoaderSectionRequest = options
			? (url, type, withCredentials, headers) =>
					this.loadResource(url, type, withCredentials, headers, options)
			: (url, type, withCredentials, headers) =>
					this.loadResource(url, type, withCredentials, headers, undefined);

		return section.load(request).then((contents) => {
			this.trackLoadedSection(section);
			if (this.performance) {
				this.performance.count(cacheHit ? "spine.load.hit" : "spine.load.miss", 1);
				this.performance.end(span, {
					status: "resolved"
				});
			}
			return contents;
		}).catch((error) => {
			if (this.performance) {
				this.performance.end(span, {
					status: "rejected",
					error: error && error.message
				});
			}
			throw error;
		});
	}

	pin(section: SpineLoaderSection): void {
		const index = this.getSectionIndex(section);
		if (typeof index === "undefined") {
			return;
		}

		const count = this.pinnedSections.get(index) || 0;
		this.pinnedSections.set(index, count + 1);
		this.trackLoadedSection(section);
	}

	unpin(section: SpineLoaderSection): void {
		const index = this.getSectionIndex(section);
		if (typeof index === "undefined") {
			return;
		}

		const count = this.pinnedSections.get(index);
		if (!count) {
			return;
		}

		if (count > 1) {
			this.pinnedSections.set(index, count - 1);
		} else {
			this.pinnedSections.delete(index);
		}

		this.evictLoadedSections();
	}

	isPinned(section: SpineLoaderSection): boolean {
		const index = this.getSectionIndex(section);
		if (typeof index === "undefined") {
			return false;
		}

		return this.pinnedSections.has(index);
	}

	cancelPrefetch(): number {
		this.prefetchVersion += 1;
		if (this.prefetchController) {
			try {
				this.prefetchController.abort();
			} catch (e) {
				// NOOP
			}
			this.prefetchController = undefined;
		}
		return this.prefetchVersion;
	}

	prefetch(
		section: SpineLoaderSection | undefined | null,
		distance?: number,
	): Promise<Array<unknown | undefined>> {
		if (!section) {
			return Promise.resolve([]);
		}

		const spanDistance = typeof distance === "number" && distance > 0 ? Math.floor(distance) : 1;
		const candidates = this.collectCandidates(section, spanDistance);
		const prefetchVersion = this.cancelPrefetch();
		const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
		this.prefetchController = controller;
		const span = this.performance && this.performance.start("spine.prefetch", {
			index: section.index,
			href: section.href,
			distance: spanDistance,
			candidates: candidates.length
		});

		const loadSequentially = (
			index: number,
			results: Array<unknown | undefined>,
		): Promise<Array<unknown | undefined>> => {
			if (index >= candidates.length) {
				return Promise.resolve(results);
			}

			if (prefetchVersion !== this.prefetchVersion) {
				results.push(undefined);
				return loadSequentially(index + 1, results);
			}

			return this.load(candidates[index], controller ? { signal: controller.signal } : undefined)
				.then((contents) => {
					if (prefetchVersion === this.prefetchVersion) {
						results.push(contents);
					} else {
						results.push(undefined);
					}
					return loadSequentially(index + 1, results);
				})
				.catch(() => {
					results.push(undefined);
					return loadSequentially(index + 1, results);
				});
		};

		return loadSequentially(0, []).then((results) => {
			if (this.performance) {
				this.performance.end(span, {
					status: "resolved",
					loaded: results.filter(Boolean).length,
					cancelled: prefetchVersion !== this.prefetchVersion
				});
			}
			if (this.prefetchController === controller) {
				this.prefetchController = undefined;
			}
			return results;
		}).catch((error) => {
			if (this.prefetchController === controller) {
				this.prefetchController = undefined;
			}
			if (this.performance) {
				this.performance.end(span, {
					status: "rejected",
					error: error && error.message
				});
			}
			throw error;
		});
	}

	private collectCandidates(section: SpineLoaderSection, distance: number): SpineLoaderSection[] {
		const candidates: SpineLoaderSection[] = [];
		let next: SpineLoaderSection | undefined = section;
		let prev: SpineLoaderSection | undefined = section;

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

	private normalizeMaxLoadedSections(maxLoadedSections: SpineLoaderOptions["maxLoadedSections"]): number {
		if (maxLoadedSections === false || maxLoadedSections === 0) {
			return Infinity;
		}

		if (typeof maxLoadedSections === "number" && maxLoadedSections > 0) {
			return Math.floor(maxLoadedSections);
		}

		return Infinity;
	}

	private getSectionIndex(section: SpineLoaderSection): number | undefined {
		if (!section) {
			return;
		}
		const index = section.index;
		if (typeof index === "number") {
			return index;
		}
		if (typeof index === "string" && index !== "") {
			const numericIndex = Number(index);
			if (isNaN(numericIndex) === false) {
				return parseInt(index, 10);
			}
		}
	}

	private trackLoadedSection(section: SpineLoaderSection): void {
		const index = this.getSectionIndex(section);
		if (typeof index === "undefined") {
			return;
		}

		this.loadedSections.set(index, section);
		const existingIndex = this.loadedOrder.indexOf(index);
		if (existingIndex !== -1) {
			this.loadedOrder.splice(existingIndex, 1);
		}
		this.loadedOrder.push(index);
		this.evictLoadedSections();
	}

	private evictLoadedSections(): void {
		if (!isFinite(this.maxLoadedSections)) {
			return;
		}

		while (this.loadedOrder.length > this.maxLoadedSections) {
			const evictIndex = this.findEvictableIndex();
			if (typeof evictIndex === "undefined") {
				return;
			}
			this.evictByIndex(evictIndex);
		}
	}

	private findEvictableIndex(): number | undefined {
		for (let i = 0; i < this.loadedOrder.length; i += 1) {
			const index = this.loadedOrder[i];
			if (!this.pinnedSections.has(index)) {
				return index;
			}
		}
	}

	private evictByIndex(index: number): void {
		const orderIndex = this.loadedOrder.indexOf(index);
		if (orderIndex !== -1) {
			this.loadedOrder.splice(orderIndex, 1);
		}

		const section = this.loadedSections.get(index);
		this.loadedSections.delete(index);

		if (section && typeof section.unload === "function") {
			section.unload();
		}

		if (this.performance) {
			this.performance.mark("spine.evict", {
				index
			});
		}
	}
}

export default SpineLoader;
