export interface ResourceResolverPerformance {
	start(name: string, data?: Record<string, unknown>): unknown;
	end(span: unknown, data?: Record<string, unknown>): void;
}

export interface ResourceResolverLoadOptions {
	signal?: AbortSignal;
	[key: string]: unknown;
}

export interface ResourceResolverOptions {
	resolvePath: (path: string) => string;
	isArchived: () => boolean;
	requestArchive: (path: string, type?: string, options?: ResourceResolverLoadOptions) => Promise<unknown>;
	requestRemote: (
		path: string,
		type: string | null,
		withCredentials: unknown,
		headers: unknown,
		options?: ResourceResolverLoadOptions,
	) => Promise<unknown>;
	requestCredentials: () => unknown;
	requestHeaders: () => unknown;
	performance?: ResourceResolverPerformance;
}

class ResourceResolver {
	private resolvePath: ResourceResolverOptions["resolvePath"];
	private isArchived: ResourceResolverOptions["isArchived"];
	private requestArchive: ResourceResolverOptions["requestArchive"];
	private requestRemote: ResourceResolverOptions["requestRemote"];
	private requestCredentials: ResourceResolverOptions["requestCredentials"];
	private requestHeaders: ResourceResolverOptions["requestHeaders"];
	private performance?: ResourceResolverOptions["performance"];

	constructor(options: ResourceResolverOptions) {
		options = options || ({} as ResourceResolverOptions);

		this.resolvePath = options.resolvePath;
		this.isArchived = options.isArchived;
		this.requestArchive = options.requestArchive;
		this.requestRemote = options.requestRemote;
		this.requestCredentials = options.requestCredentials;
		this.requestHeaders = options.requestHeaders;
		this.performance = options.performance;
	}

	load(
		path: string,
		type?: string,
		withCredentials?: unknown,
		headers?: unknown,
		options?: ResourceResolverLoadOptions,
	): Promise<unknown> {
		const signal = options && options.signal;
		if (signal && signal.aborted) {
			return Promise.reject({
				name: "AbortError",
				message: "Aborted"
			});
		}

		const resolved = this.resolvePath(path);
		const archived = this.isArchived();
		const span = this.performance && this.performance.start("book.load", {
			path: resolved,
			archived: archived,
			type: type || undefined
		});

		let loading: Promise<unknown>;
		if (archived) {
			loading = this.requestArchive(resolved, type, options);
		} else {
			loading = this.requestRemote(
				resolved,
				type || null,
				typeof withCredentials === "undefined" ? this.requestCredentials() : withCredentials,
				typeof headers === "undefined" ? this.requestHeaders() : headers,
				options
			);
		}

		return loading.then((result) => {
			if (this.performance) {
				this.performance.end(span, {
					status: "resolved"
				});
			}
			return result;
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
}

export default ResourceResolver;
