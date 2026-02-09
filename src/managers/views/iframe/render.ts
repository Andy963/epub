import { borders, isNumber, bounds, defer, createBlobUrl } from "../../../utils/core";
import Contents from "../../../contents";
import { EVENTS } from "../../../utils/constants";

export function create() {
	if(this.iframe) {
		return this.iframe;
	}

	if(!this.element) {
		this.element = this.createContainer();
	}

	this.iframe = document.createElement("iframe");
	this.iframe.id = this.id;
	this.iframe.scrolling = "no"; // Might need to be removed: breaks ios width calculations
	this.iframe.style.overflow = "hidden";
	this.iframe.seamless = "seamless";
	// Back up if seamless isn't supported
	this.iframe.style.border = "none";

	// sandbox
	this.iframe.sandbox = "allow-same-origin";
	if (this.settings.allowScriptedContent) {
		this.iframe.sandbox += " allow-scripts";
	}
	if (this.settings.allowPopups) {
		this.iframe.sandbox += " allow-popups";
	}

	this.iframe.setAttribute("enable-annotation", "true");

	this.resizing = true;

	// this.iframe.style.display = "none";
	this.element.style.visibility = "hidden";
	this.iframe.style.visibility = "hidden";

	this.iframe.style.width = "0";
	this.iframe.style.height = "0";
	this._width = 0;
	this._height = 0;

	this.element.setAttribute("ref", this.index);

	this.added = true;

	this.elementBounds = bounds(this.element);

	// if(width || height){
	//   this.resize(width, height);
	// } else if(this.width && this.height){
	//   this.resize(this.width, this.height);
	// } else {
	//   this.iframeBounds = bounds(this.iframe);
	// }


	if(("srcdoc" in this.iframe)) {
		this.supportsSrcdoc = true;
	} else {
		this.supportsSrcdoc = false;
	}

	if (!this.settings.method) {
		this.settings.method = this.supportsSrcdoc ? "srcdoc" : "write";
	}

	return this.iframe;
}

export function render(request, show?) {
	// view.onLayout = this.layout.format.bind(this.layout);
	this.create();

	// Fit to size of the container, apply padding
	this.size();

	if(!this.sectionRender) {
		if (this.section) {
			this.section._resourceParentKey = this.id;
		}
		this.sectionRender = this.section.render(request);
	}

	// Render Chain
	return this.sectionRender
		.then(function(contents){
			return this.load(contents);
		}.bind(this))
		.then(function(){

			// find and report the writingMode axis
			let writingMode = this.contents.writingMode();

			// Set the axis based on the flow and writing mode
			let axis;
			if (this.settings.flow === "scrolled") {
				axis = (writingMode.indexOf("vertical") === 0) ? "horizontal" : "vertical";
			} else {
				axis = (writingMode.indexOf("vertical") === 0) ? "vertical" : "horizontal";
			}

			if (writingMode.indexOf("vertical") === 0 && this.settings.flow === "paginated") {
				this.layout.delta = this.layout.height;
			}

			this.setAxis(axis);
			this.emit(EVENTS.VIEWS.AXIS, axis);

			this.setWritingMode(writingMode);
			this.emit(EVENTS.VIEWS.WRITING_MODE, writingMode);

				this.enableSelectionScrollLock();

				// apply the layout function to the contents
				this.layout.format(this.contents, this.section, axis);

			// Listen for events that require an expansion of the iframe
			this.addListeners();

			return new Promise((resolve, reject) => {
				// Expand the iframe to the full size of the content
				this.expand();

				if (this.settings.forceRight) {
					this.element.style.marginLeft = this.width() + "px";
				}
				resolve();
			});

		}.bind(this), function(e){
			this.emit(EVENTS.VIEWS.LOAD_ERROR, e);
			return new Promise((resolve, reject) => {
				reject(e);
			});
		}.bind(this))
		.then(function() {
			this.emit(EVENTS.VIEWS.RENDERED, this.section);
		}.bind(this));
}

export function reset() {
	if (this.iframe) {
		this.iframe.style.width = "0";
		this.iframe.style.height = "0";
		this._width = 0;
		this._height = 0;
		this._textWidth = undefined;
		this._contentWidth = undefined;
		this._textHeight = undefined;
		this._contentHeight = undefined;
	}
	this._needsReframe = true;
}

// Determine locks base on settings
export function size(_width?, _height?) {
	var width = _width || this.settings.width;
	var height = _height || this.settings.height;

	if(this.layout.name === "pre-paginated") {
		this.lock("both", width, height);
	} else if(this.settings.axis === "horizontal") {
		this.lock("height", width, height);
	} else {
		this.lock("width", width, height);
	}

	this.settings.width = width;
	this.settings.height = height;
}

// Lock an axis to element dimensions, taking borders into account
export function lock(what, width, height) {
	var elBorders = borders(this.element);
	var iframeBorders;

	if(this.iframe) {
		iframeBorders = borders(this.iframe);
	} else {
		iframeBorders = {width: 0, height: 0};
	}

	if(what == "width" && isNumber(width)){
		this.lockedWidth = width - elBorders.width - iframeBorders.width;
		// this.resize(this.lockedWidth, width); //  width keeps ratio correct
	}

	if(what == "height" && isNumber(height)){
		this.lockedHeight = height - elBorders.height - iframeBorders.height;
		// this.resize(width, this.lockedHeight);
	}

	if(what === "both" &&
		 isNumber(width) &&
		 isNumber(height)){

		this.lockedWidth = width - elBorders.width - iframeBorders.width;
		this.lockedHeight = height - elBorders.height - iframeBorders.height;
		// this.resize(this.lockedWidth, this.lockedHeight);
	}

	if(this.displayed && this.iframe) {

		// this.contents.layout();
		this.expand();
	}
}

// Resize a single axis based on content dimensions
export function expand(force?) {
	var width = this.lockedWidth;
	var height = this.lockedHeight;
	var columns;

	var textWidth, textHeight;

	if(!this.iframe || this._expanding) return;

	this._expanding = true;

		if(this.layout.name === "pre-paginated") {
			width = this.layout.columnWidth;
			height = this.layout.height;
			if (this.layout.divisor > 1 &&
				this.section &&
				(this.section.index === 0 || (this.section.properties && this.section.properties.includes("page-spread-center")))) {
				width = this.layout.spreadWidth;
			}
		}
	// Expand Horizontally
	else if(this.settings.axis === "horizontal") {
		// Get the width of the text
		width = this.contents.textWidth();

		if (width % this.layout.pageWidth > 0) {
			width = Math.ceil(width / this.layout.pageWidth) * this.layout.pageWidth;
		}

		if (this.settings.forceEvenPages) {
			columns = Math.floor(width / this.layout.pageWidth);
			if (this.layout.divisor > 1 && this.layout.name === "reflowable") {
				const remainder = columns % this.layout.divisor;
				if (remainder > 0) {
					// add blank pages to complete the spread
					width += this.layout.pageWidth * (this.layout.divisor - remainder);
				}
			}
		}

	} // Expand Vertically
	else if(this.settings.axis === "vertical") {
		height = this.contents.textHeight();
		if (this.settings.flow === "paginated" &&
			height % this.layout.height > 0) {
			height = Math.ceil(height / this.layout.height) * this.layout.height;
		}
	}

	// Only Resize if dimensions have changed or
	// if Frame is still hidden, so needs reframing
	if(this._needsReframe || width != this._width || height != this._height){
		this.reframe(width, height);
	}

	this._expanding = false;
}

export function reframe(width, height) {
	var size;

	if(isNumber(width)){
		this.element.style.width = width + "px";
		this.iframe.style.width = width + "px";
		this._width = width;
	}

	if(isNumber(height)){
		this.element.style.height = height + "px";
		this.iframe.style.height = height + "px";
		this._height = height;
	}

	let widthDelta = this.prevBounds ? width - this.prevBounds.width : width;
	let heightDelta = this.prevBounds ? height - this.prevBounds.height : height;

	size = {
		width: width,
		height: height,
		widthDelta: widthDelta,
		heightDelta: heightDelta,
	};

	this.pane && this.pane.render();

	requestAnimationFrame(() => {
		let mark;
		for (let m in this.marks) {
			if (this.marks.hasOwnProperty(m)) {
				mark = this.marks[m];
				this.placeMark(mark.element, mark.range);
			}
		}
	});

	this.onResize(this, size);

	this.emit(EVENTS.VIEWS.RESIZED, size);

	this.prevBounds = size;

	this.elementBounds = bounds(this.element);
}

export function load(contents) {
	var loading = new defer();
	var loaded = loading.promise;

	if(!this.iframe) {
		loading.reject(new Error("No Iframe Available"));
		return loaded;
	}

	this.iframe.onload = function(event) {

		this.onLoad(event, loading);

	}.bind(this);

	if (this.settings.method === "blobUrl") {
		this.blobUrl = createBlobUrl(contents, "application/xhtml+xml");
		this.iframe.src = this.blobUrl;
		this.element.appendChild(this.iframe);
	} else if(this.settings.method === "srcdoc"){
		this.iframe.srcdoc = contents;
		this.element.appendChild(this.iframe);
	} else {

		this.element.appendChild(this.iframe);

		this.document = this.iframe.contentDocument;

		if(!this.document) {
			loading.reject(new Error("No Document Available"));
			return loaded;
			}

			this.iframe.contentDocument.open();
			// For Cordova windows platform
			const w = window as any;
			if(w.MSApp && w.MSApp.execUnsafeLocalFunction) {
				var outerThis = this;
				w.MSApp.execUnsafeLocalFunction(function () {
					outerThis.iframe.contentDocument.write(contents);
				});
			} else {
				this.iframe.contentDocument.write(contents);
		}
		this.iframe.contentDocument.close();

	}

	return loaded;
}

export function onLoad(event, promise) {
	this.window = this.iframe.contentWindow;
	this.document = this.iframe.contentDocument;

	this.contents = new Contents(this.document, this.document.body, this.section.cfiBase, this.section.index);

	this.rendering = false;

	var link = this.document.querySelector("link[rel='canonical']");
	if (link) {
		link.setAttribute("href", this.section.canonical);
	} else {
		link = this.document.createElement("link");
		link.setAttribute("rel", "canonical");
		link.setAttribute("href", this.section.canonical);
		this.document.querySelector("head").appendChild(link);
	}

		this.contents.on(EVENTS.CONTENTS.EXPAND, () => {
			if(this.displayed && this.iframe) {
				this.expand();
				if (this.contents) {
					this.layout.format(this.contents, this.section, this.settings.axis);
				}
			}
		});

		this.contents.on(EVENTS.CONTENTS.RESIZE, (e) => {
			if(this.displayed && this.iframe) {
				this.expand();
				if (this.contents) {
					this.layout.format(this.contents, this.section, this.settings.axis);
				}
			}
		});

	promise.resolve(this.contents);
}

