import FontObfuscation from "../core/obfuscation";
import { ENCRYPTION_PATH } from "./constants";

export async function applyFontObfuscationReplacementsIfNeeded() {
	if (
		this.archived ||
		this.settings.deobfuscate === false ||
		!this.obfuscation ||
		!this.resources ||
		!this.spine ||
		!this.spine.hooks ||
		!this.spine.hooks.serialize
	) {
		return;
	}

	if (this.resources.settings && this.resources.settings.lazy) {
		// Lazy replacement already loads assets through `load()` and thus can deobfuscate fonts.
		return;
	}

	// If the user explicitly configured replacements, keep their original behavior.
	if (typeof this.settings.replacements !== "undefined") {
		return;
	}

	// Respect explicit disable
	if (this.resources.settings && this.resources.settings.replacements === "none") {
		return;
	}

	if (!this._obfuscationSubstituteHook) {
		this._obfuscationSubstituteHook = (output, section) => {
			section.output = this.resources.substitute(output, section.url);
		};
		this.spine.hooks.serialize.register(this._obfuscationSubstituteHook);
	}

	const obfuscation = this.obfuscation;
	const resources = this.resources;
	const resolver =
		resources.settings && typeof resources.settings.resolver === "function"
			? resources.settings.resolver
			: (href) => href;

	if (!Array.isArray(resources.replacementUrls) || resources.replacementUrls.length !== resources.urls.length) {
		resources.replacementUrls = new Array(resources.urls.length);
	}

	const fontTasks = [];

	for (let i = 0; i < resources.urls.length; i += 1) {
		const href = resources.urls[i];
		if (!href || resources.replacementUrls[i]) {
			continue;
		}

		const resolved = resolver(href);
		if (!resolved || !obfuscation.isObfuscated(resolved)) {
			continue;
		}

		fontTasks.push(
			resources
				.createUrl(resolved)
				.then((url) => {
					if (url) {
						resources.replacementUrls[i] = url;
					}
				})
				.catch(() => {
					return;
				})
		);
	}

	if (fontTasks.length) {
		await Promise.all(fontTasks);
	}

	// Update CSS hrefs so that `@font-face url(...)` inside CSS points to deobfuscated font URLs.
	try {
		await resources.replaceCss();
	} catch (e) {
		// NOOP
	}
}

export async function loadFontObfuscation() {
	if (this.settings.deobfuscate === false) {
		return;
	}

	if (!this.packaging || !this.url) {
		return;
	}

	const uniqueIdentifier = this.packaging.uniqueIdentifier || "";
	if (!uniqueIdentifier) {
		return;
	}

	const resolveRoot = () => {
		try {
			return this.url.resolve(ENCRYPTION_PATH);
		} catch (e) {
			return "/" + ENCRYPTION_PATH;
		}
	};

	let encryption;
	try {
		encryption = await this.load(resolveRoot(), "xml");
	} catch (e) {
		return;
	}

	const rootDirectory =
		this.url && this.url.Path && typeof this.url.Path.directory === "string"
			? this.url.Path.directory
			: this.url && typeof this.url.directory === "string"
				? this.url.directory
				: "";

	const obfuscation = FontObfuscation.fromEncryption(encryption, uniqueIdentifier, {
		rootDirectory,
	});
	if (!obfuscation) {
		return;
	}

	this.obfuscation = obfuscation;

	if (this.archive && typeof this.archive.setObfuscation === "function") {
		this.archive.setObfuscation(obfuscation);
	} else if (this.archive) {
		this.archive.obfuscation = obfuscation;
	}
}

