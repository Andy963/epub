/**
 * Hook to handle injecting stylesheet before
 * a Section is serialized
 * @param  {document} doc
 * @param  {Section} section
 * @private
 */
export function injectStylesheet(doc, section) {
	let style = doc.createElement("link");
	style.setAttribute("type", "text/css");
	style.setAttribute("rel", "stylesheet");
	style.setAttribute("href", this.settings.stylesheet);
	doc.getElementsByTagName("head")[0].appendChild(style);
}

/**
 * Hook to handle injecting scripts before
 * a Section is serialized
 * @param  {document} doc
 * @param  {Section} section
 * @private
 */
export function injectScript(doc, section) {
	let script = doc.createElement("script");
	script.setAttribute("type", "text/javascript");
	script.setAttribute("src", this.settings.script);
	script.textContent = " "; // Needed to prevent self closing tag
	doc.getElementsByTagName("head")[0].appendChild(script);
}

/**
 * Hook to handle the document identifier before
 * a Section is serialized
 * @param  {document} doc
 * @param  {Section} section
 * @private
 */
export function injectIdentifier(doc, section) {
	let ident = this.book.packaging.metadata.identifier;
	let meta = doc.createElement("meta");
	meta.setAttribute("name", "dc.relation.ispartof");
	if (ident) {
		meta.setAttribute("content", ident);
	}
	doc.getElementsByTagName("head")[0].appendChild(meta);
}

