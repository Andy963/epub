import Url from "./utils/url";

export interface ThemeDefinition {
	rules?: Record<string, any>;
	url?: string;
	serialized?: string;
	injected?: boolean;
}

export interface ThemeOverride {
	value: any;
	priority: boolean;
}

/**
 * Themes to apply to displayed content
 * @class
 * @param {Rendition} rendition
 */
class Themes {
	rendition: any;
	private _themes: Record<string, ThemeDefinition>;
	private _overrides: Record<string, ThemeOverride>;
	private _current: string;
	private _injected: any[];
	private _overrideRaf: WeakMap<any, number>;

	constructor(rendition: any) {
		this.rendition = rendition;
		this._themes = {
			"default" : {
				"rules" : {},
				"url" : "",
				"serialized" : ""
			}
		};
		this._overrides = {};
		this._current = "default";
		this._injected = [];
		this._overrideRaf = new WeakMap();
		this.rendition.hooks.content.register(this.inject.bind(this));
		this.rendition.hooks.content.register(this.overrides.bind(this));

	}

	/**
	 * Add themes to be used by a rendition
	 * @param {object | Array<object> | string}
	 * @example themes.register("light", "http://example.com/light.css")
	 * @example themes.register("light", { "body": { "color": "purple"}})
	 * @example themes.register({ "light" : {...}, "dark" : {...}})
	 */
	register (..._args: any[]): any {
		if (arguments.length === 0) {
			return;
		}
		if (arguments.length === 1 && typeof(arguments[0]) === "object") {
			return this.registerThemes(arguments[0]);
		}
		if (arguments.length === 1 && typeof(arguments[0]) === "string") {
			return this.default(arguments[0]);
		}
		if (arguments.length === 2 && typeof(arguments[1]) === "string") {
			return this.registerUrl(arguments[0], arguments[1]);
		}
		if (arguments.length === 2 && typeof(arguments[1]) === "object") {
			return this.registerRules(arguments[0], arguments[1]);
		}
	}

	/**
	 * Add a default theme to be used by a rendition
	 * @param {object | string} theme
	 * @example themes.register("http://example.com/default.css")
	 * @example themes.register({ "body": { "color": "purple"}})
	 */
	default (theme: any): any {
		if (!theme) {
			return;
		}
		if (typeof(theme) === "string") {
			return this.registerUrl("default", theme);
		}
		if (typeof(theme) === "object") {
			return this.registerRules("default", theme);
		}
	}

	/**
	 * Register themes object
	 * @param {object} themes
	 */
	registerThemes (themes: Record<string, any>): void {
		for (var theme in themes) {
			if (themes.hasOwnProperty(theme)) {
				if (typeof(themes[theme]) === "string") {
					this.registerUrl(theme, themes[theme]);
				} else {
					this.registerRules(theme, themes[theme]);
				}
			}
		}
	}

	/**
	 * Register a theme by passing its css as string
	 * @param {string} name 
	 * @param {string} css 
	 */
	registerCss (name: string, css: string): void {
		this._themes[name] = { "serialized" : css };
		if (this._injected[name] || name == 'default') {
			this.update(name);
		}
	}

	/**
	 * Register a url
	 * @param {string} name
	 * @param {string} input
	 */
	registerUrl (name: string, input: string): void {
		var url = new Url(input);
		this._themes[name] = { "url": url.toString() };
		if (this._injected[name] || name == 'default') {
			this.update(name);
		}
	}

	/**
	 * Register rule
	 * @param {string} name
	 * @param {object} rules
	 */
	registerRules (name: string, rules: Record<string, any>): void {
		this._themes[name] = { "rules": rules };
		// TODO: serialize css rules
		if (this._injected[name] || name == 'default') {
			this.update(name);
		}
	}

	/**
	 * Select a theme
	 * @param {string} name
	 */
	select (name: string): void {
		var prev = this._current;
		var contents;

		this._current = name;
		this.update(name);

		contents = this.rendition.getContents();
		contents.forEach( (content) => {
			if (prev && prev !== "default") {
				this._setStylesheetDisabled(prev, content, true);
				content.removeClass(prev);
			}

			if (name && name !== "default") {
				this._setStylesheetDisabled(name, content, false);
				content.addClass(name);
			}
		});
	}

	_getStylesheetNode(name: string, contents: any): any {
		var theme = this._themes[name];

		if (!theme || !contents || !contents.document) {
			return;
		}

		if (theme.url) {
			return contents.document.querySelector("link[href='"+theme.url+"']");
		}

		return contents.document.getElementById("epubjs-inserted-css-" + name);
	}

	_setStylesheetDisabled(name: string, contents: any, disabled: boolean): void {
		var node = this._getStylesheetNode(name, contents);

		if (node) {
			node.disabled = disabled;
			if (node.sheet) {
				node.sheet.disabled = disabled;
			}
		}
	}

	/**
	 * Update a theme
	 * @param {string} name
	 */
	update (name: string): void {
		var contents = this.rendition.getContents();
		contents.forEach( (content) => {
			this.add(name, content);
		});
	}

	/**
	 * Inject all themes into contents
	 * @param {Contents} contents
	 */
	inject (contents: any): void {
		var links = [];
		var themes = this._themes;
		var theme;

		for (var name in themes) {
			if (themes.hasOwnProperty(name) && (name === this._current || name === "default")) {
				theme = themes[name];
				if((theme.rules && Object.keys(theme.rules).length > 0) || (theme.url && links.indexOf(theme.url) === -1)) {
					this.add(name, contents);
				}
				this._injected.push(name);
			}
		}

		if(this._current != "default") {
			contents.addClass(this._current);
		}
	}

	/**
	 * Add Theme to contents
	 * @param {string} name
	 * @param {Contents} contents
	 */
	add (name: string, contents: any): void {
		var theme = this._themes[name];

		if (!theme || !contents) {
			return;
		}

		if (theme.url) {
			contents.addStylesheet(theme.url);
		} else if (theme.serialized) {
			contents.addStylesheetCss(theme.serialized, name);
			theme.injected = true;
		} else if (theme.rules) {
			contents.addStylesheetRules(theme.rules, name);
			theme.injected = true;
		}
	}

	/**
	 * Add override
	 * @param {string} name
	 * @param {string} value
	 * @param {boolean} priority
	 */
	override (name: string, value: any, priority?: boolean): void {
		var contents = this.rendition.getContents();

		this._overrides[name] = {
			value: value,
			priority: priority === true
		};

		contents.forEach( (content) => {
			content.css(name, this._overrides[name].value, this._overrides[name].priority);
			if (content.window && content.window.requestAnimationFrame) {
				let prev = this._overrideRaf.get(content);
				if (prev && content.window.cancelAnimationFrame) {
					content.window.cancelAnimationFrame(prev);
				}

				let raf = content.window.requestAnimationFrame(() => {
					this._overrideRaf.delete(content);
					if (content.expand) {
						content.expand();
					}
				});

				this._overrideRaf.set(content, raf);
			}
		});
	}

	removeOverride (name: string): void {
		var contents = this.rendition.getContents();

		delete this._overrides[name];

		contents.forEach( (content) => {
			content.css(name);
		});
	}

	/**
	 * Add all overrides
	 * @param {Content} content
	 */
	overrides (contents: any): void {
		var overrides = this._overrides;

		for (var rule in overrides) {
			if (overrides.hasOwnProperty(rule)) {
				contents.css(rule, overrides[rule].value, overrides[rule].priority);
			}
		}
	}

	/**
	 * Adjust the font size of a rendition
	 * @param {number} size
	 */
	fontSize (size: number): void {
		this.override("font-size", size);
	}

	/**
	 * Adjust the font-family of a rendition
	 * @param {string} f
	 */
	font (f: string): void {
		this.override("font-family", f, true);
	}

	destroy(): void {
		this.rendition = undefined;
		this._themes = undefined;
		this._overrides = undefined;
		this._current = undefined;
		this._injected = undefined;
		this._overrideRaf = undefined;
	}

}

export default Themes;
