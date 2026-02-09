import EventEmitter from "event-emitter";
import { extend, defer } from "./utils/core";
import Hook from "./utils/hook";
import EpubCFI from "./epubcfi";
import Queue from "./utils/queue";
import Themes from "./themes";
import Annotations from "./annotations";

import { display as displayImpl, _display as _displayImpl } from "./rendition/display";
import { injectIdentifier as injectIdentifierImpl, injectScript as injectScriptImpl, injectStylesheet as injectStylesheetImpl } from "./rendition/inject";
import {
	determineLayoutProperties as determineLayoutPropertiesImpl,
	direction as directionImpl,
	fixedLayoutZoom as fixedLayoutZoomImpl,
	flow as flowImpl,
	layout as layoutImpl,
	spread as spreadImpl,
} from "./rendition/layout";
import { currentLocation as currentLocationImpl, located as locatedImpl, reportLocation as reportLocationImpl } from "./rendition/location";
import {
	clear as clearImpl,
	destroy as destroyImpl,
	getContents as getContentsImpl,
	moveTo as moveToImpl,
	next as nextImpl,
	onOrientationChange as onOrientationChangeImpl,
	onResized as onResizedImpl,
	prev as prevImpl,
	resize as resizeImpl,
	views as viewsImpl,
} from "./rendition/navigation";
import {
	adjustImages as adjustImagesImpl,
	getRange as getRangeImpl,
	passEvents as passEventsImpl,
	triggerMarkEvent as triggerMarkEventImpl,
	triggerSelectedEvent as triggerSelectedEventImpl,
	triggerViewEvent as triggerViewEventImpl,
} from "./rendition/hooks";
import { handleLinks as handleLinksImpl, resolveFootnote as resolveFootnoteImpl } from "./rendition/links";
import { requireManager as requireManagerImpl, requireView as requireViewImpl, setManager as setManagerImpl } from "./rendition/manager";
import { attachTo as attachToImpl, start as startImpl } from "./rendition/start";
import { afterDisplayed as afterDisplayedImpl, afterRemoved as afterRemovedImpl } from "./rendition/views";

/**
 * Displays an Epub as a series of Views for each Section.
 * Requires Manager and View class to handle specifics of rendering
 * the section content.
 * @class
 * @param {Book} book
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {string | function} [options.ignoreClass] class name or predicate for the cfi parser to ignore
 * @param {number | object} [options.margin] stage padding for paginated layout
 * @param {number | string} [options.maxInlineSize] max width of the stage container
 * @param {number | string} [options.maxBlockSize] max height of the stage container
 * @param {number} [options.gap] gap between columns in paginated flow
 * @param {number} [options.maxColumnCount] maximum visible column count in paginated flow
 * @param {string | function | object} [options.manager='default']
 * @param {string | function} [options.view='iframe']
 * @param {string} [options.layout] layout to force
 * @param {string} [options.spread] force spread value
 * @param {number} [options.minSpreadWidth] overridden by spread: none (never) / both (always)
 * @param {string} [options.stylesheet] url of stylesheet to be injected
 * @param {boolean} [options.resizeOnOrientationChange] false to disable orientation events
 * @param {string} [options.script] url of script to be injected
 * @param {boolean | object} [options.snap=false] use snap scrolling
 * @param {string} [options.defaultDirection='ltr'] default text direction
 * @param {boolean} [options.allowScriptedContent=false] enable running scripts in content
 * @param {boolean} [options.allowPopups=false] enable opening popup in content
 * @param {boolean | number} [options.prefetch=false] prefetch neighboring sections after display
 */
class Rendition {
	[key: string]: any;

	constructor(book, options) {
		this.settings = extend(this.settings || {}, {
			width: null,
			height: null,
			ignoreClass: "",
			margin: undefined,
			maxInlineSize: undefined,
			maxBlockSize: undefined,
			gap: undefined,
			maxColumnCount: undefined,
			manager: "default",
			view: "iframe",
			flow: null,
			layout: null,
			spread: null,
			minSpreadWidth: 800,
			stylesheet: null,
			resizeOnOrientationChange: true,
			script: null,
			snap: false,
			defaultDirection: "ltr",
			allowScriptedContent: false,
			allowPopups: false,
			openExternalLinks: true,
			prefetch: false,
			footnotes: false,
			fixedLayout: null
		});

		extend(this.settings, options);

		if (typeof(this.settings.manager) === "object") {
			this.manager = this.settings.manager;
		}

		this.book = book;

		/**
		 * Adds Hook methods to the Rendition prototype
		 * @member {object} hooks
		 * @property {Hook} hooks.content
		 * @memberof Rendition
		 */
		this.hooks = {};
		this.hooks.display = new Hook(this);
		this.hooks.serialize = new Hook(this);
		this.hooks.content = new Hook(this);
		this.hooks.unloaded = new Hook(this);
		this.hooks.layout = new Hook(this);
		this.hooks.render = new Hook(this);
		this.hooks.show = new Hook(this);
		this.hooks.header = new Hook(this);
		this.hooks.footer = new Hook(this);

		this.hooks.content.register(this.handleLinks.bind(this));
		this.hooks.content.register(this.passEvents.bind(this));
		this.hooks.content.register(this.adjustImages.bind(this));

		this.book.spine.hooks.content.register(this.injectIdentifier.bind(this));

		if (this.settings.stylesheet) {
			this.book.spine.hooks.content.register(this.injectStylesheet.bind(this));
		}

		if (this.settings.script) {
			this.book.spine.hooks.content.register(this.injectScript.bind(this));
		}

		/**
		 * @member {Themes} themes
		 * @memberof Rendition
		 */
		this.themes = new Themes(this);

		/**
		 * @member {Annotations} annotations
		 * @memberof Rendition
		 */
		this.annotations = new Annotations(this);

		this.epubcfi = new EpubCFI();

		this.q = new Queue(this);

		this.location = undefined;
		this._hasRequestedDisplay = false;
		this._lastRequestedTarget = undefined;

		// Hold queue until book is opened
		this.q.enqueue(this.book.opened);

		this.starting = new defer();
		/**
		 * @member {promise} started returns after the rendition has started
		 * @memberof Rendition
		 */
		this.started = this.starting.promise;

		// Block the queue until rendering is started
		this.q.enqueue(this.start);
	}

	setManager(manager) {
		return setManagerImpl.call(this, manager);
	}

	requireManager(manager) {
		return requireManagerImpl.call(this, manager);
	}

	requireView(view) {
		return requireViewImpl.call(this, view);
	}

	start(){
		return startImpl.call(this);
	}

	attachTo(element){
		return attachToImpl.call(this, element);
	}

	display(target){
		return displayImpl.call(this, target);
	}

	_display(target){
		return _displayImpl.call(this, target);
	}

	afterDisplayed(view){
		return afterDisplayedImpl.call(this, view);
	}

	afterRemoved(view){
		return afterRemovedImpl.call(this, view);
	}

	onResized(size, epubcfi){
		return onResizedImpl.call(this, size, epubcfi);
	}

	onOrientationChange(orientation){
		return onOrientationChangeImpl.call(this, orientation);
	}

	moveTo(offset){
		return moveToImpl.call(this, offset);
	}

	resize(width, height, epubcfi){
		return resizeImpl.call(this, width, height, epubcfi);
	}

	clear(){
		return clearImpl.call(this);
	}

	next(){
		return nextImpl.call(this);
	}

	prev(){
		return prevImpl.call(this);
	}

	determineLayoutProperties(metadata){
		return determineLayoutPropertiesImpl.call(this, metadata);
	}

	flow(flow){
		return flowImpl.call(this, flow);
	}

	layout(settings){
		return layoutImpl.call(this, settings);
	}

	fixedLayoutZoom(zoom?) {
		return fixedLayoutZoomImpl.call(this, zoom);
	}

	spread(spread, min){
		return spreadImpl.call(this, spread, min);
	}

	direction(dir){
		return directionImpl.call(this, dir);
	}

	reportLocation(){
		return reportLocationImpl.call(this);
	}

	currentLocation(){
		return currentLocationImpl.call(this);
	}

	located(location){
		return locatedImpl.call(this, location);
	}

	destroy(){
		return destroyImpl.call(this);
	}

	passEvents(contents){
		return passEventsImpl.call(this, contents);
	}

	triggerViewEvent(e, contents){
		return triggerViewEventImpl.call(this, e, contents);
	}

	triggerSelectedEvent(cfirange, contents){
		return triggerSelectedEventImpl.call(this, cfirange, contents);
	}

	triggerMarkEvent(cfiRange, data, contents){
		return triggerMarkEventImpl.call(this, cfiRange, data, contents);
	}

	getRange(cfi, ignoreClass){
		return getRangeImpl.call(this, cfi, ignoreClass);
	}

	adjustImages(contents) {
		return adjustImagesImpl.call(this, contents);
	}

	getContents () {
		return getContentsImpl.call(this);
	}

	views () {
		return viewsImpl.call(this);
	}

	handleLinks(contents) {
		return handleLinksImpl.call(this, contents);
	}

	resolveFootnote(href, options) {
		return resolveFootnoteImpl.call(this, href, options);
	}

	injectStylesheet(doc, section) {
		return injectStylesheetImpl.call(this, doc, section);
	}

	injectScript(doc, section) {
		return injectScriptImpl.call(this, doc, section);
	}

	injectIdentifier(doc, section) {
		return injectIdentifierImpl.call(this, doc, section);
	}
}

//-- Enable binding events to Renderer
EventEmitter(Rendition.prototype);

export default Rendition;

