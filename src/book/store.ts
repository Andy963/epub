import Url from "../utils/url";
import request from "../utils/request";
import Store from "../store";

/**
 * Store the epubs contents
 * @private
 * @param  {binary} input epub data
 * @param  {string} [encoding]
 * @return {Store}
 */
export function store(name) {
	// Use "blobUrl" or "base64" for replacements
	let replacementsSetting = this.settings.replacements && this.settings.replacements !== "none";
	// Save original url
	let originalUrl = this.url;
	// Save original request method
	let requester = this.settings.requestMethod || request.bind(this);
	// Create new Store
	this.storage = new Store(name, requester, this.resolve.bind(this));
	// Replace request method to go through store
	this.request = this.storage.request.bind(this.storage);

	this.opened.then(() => {
		if (this.archived) {
			this.storage.requester = this.archive.request.bind(this.archive);
		}
		// Substitute hook
		let substituteResources = (output, section) => {
			if (this.resources && this.resources.settings && this.resources.settings.lazy) {
				return this.resources.replace(output, section);
			}

			section.output = this.resources.substitute(output, section.url);
		};

		// Set to use replacements
		this.resources.settings.replacements = replacementsSetting || "blobUrl";
		// Create replacement urls
		if (!this.resources.settings.lazy) {
			this.resources.replacements().then(() => {
				return this.resources.replaceCss();
			});
		}

		this.storage.on("offline", () => {
			// Remove url to use relative resolving for hrefs
			this.url = new Url("/", "");
			// Add hook to replace resources in contents
			this.spine.hooks.serialize.register(substituteResources);
		});

		this.storage.on("online", () => {
			// Restore original url
			this.url = originalUrl;
			// Remove hook
			this.spine.hooks.serialize.deregister(substituteResources);
		});
	});

	return this.storage;
}

/**
 * Get the cover url
 * @return {Promise<?string>} coverUrl
 */
export function coverUrl() {
	return this.loaded.cover.then(() => {
		if (!this.cover) {
			return null;
		}

		if (this.archived) {
			return this.archive.createUrl(this.cover);
		} else {
			return this.cover;
		}
	});
}

