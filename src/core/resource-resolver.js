class ResourceResolver {
	constructor(options) {
		options = options || {};

		this.resolvePath = options.resolvePath;
		this.isArchived = options.isArchived;
		this.requestArchive = options.requestArchive;
		this.requestRemote = options.requestRemote;
		this.requestCredentials = options.requestCredentials;
		this.requestHeaders = options.requestHeaders;
		this.performance = options.performance;
	}

	load(path, type, withCredentials, headers, options) {
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

		let loading;
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
