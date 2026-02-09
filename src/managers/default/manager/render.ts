import scrollType from "../../../utils/scrolltype";
import Stage from "../../helpers/stage";
import Views from "../../helpers/views";
import Snap from "../../helpers/snap";

export function render(element, size) {
	let tag = element.tagName;

	if (
		typeof this.settings.fullsize === "undefined" &&
		tag &&
		(tag.toLowerCase() == "body" || tag.toLowerCase() == "html")
	) {
		this.settings.fullsize = true;
	}

	if (this.settings.fullsize) {
		this.settings.overflow = "visible";
		this.overflow = this.settings.overflow;
	}

	this.settings.size = size;

	this.settings.rtlScrollType = scrollType();

	// Save the stage
	this.stage = new Stage({
		width: size.width,
		height: size.height,
		padding: this.settings.margin,
		maxInlineSize: this.settings.maxInlineSize,
		maxBlockSize: this.settings.maxBlockSize,
		overflow: this.overflow,
		hidden: this.settings.hidden,
		axis: this.settings.axis,
		fullsize: this.settings.fullsize,
		direction: this.settings.direction,
	});

	this.stage.attachTo(element);

	// Get this stage container div
	this.container = this.stage.getContainer();

	// Views array methods
	this.views = new Views(this.container);

	// Calculate Stage Size
	this._bounds = this.bounds();
	this._stageSize = this.stage.size();

	// Set the dimensions for views
	this.viewSettings.width = this._stageSize.width;
	this.viewSettings.height = this._stageSize.height;

	// Function to handle a resize event.
	// Will only attach if width and height are both fixed.
	this.stage.onResize(this.onResized.bind(this));

	this.stage.onOrientationChange(this.onOrientationChange.bind(this));

	// Add Event Listeners
	this.addEventListeners();

	// Add Layout method
	// this.applyLayoutMethod();
	if (this.layout) {
		this.updateLayout();
	}

	this.rendered = true;
}

export function addEventListeners() {
	var scroller;

	window.addEventListener(
		"unload",
		function (e) {
			this.destroy();
		}.bind(this)
	);

	if (!this.settings.fullsize) {
		scroller = this.container;
	} else {
		scroller = window;
	}

	this._onScroll = this.onScroll.bind(this);
	scroller.addEventListener("scroll", this._onScroll);

	if (this.isPaginated && this.settings.snap) {
		this.snapper = new Snap(
			this,
			this.settings.snap &&
				typeof this.settings.snap === "object" &&
				this.settings.snap
		);
	}
}

export function removeEventListeners() {
	var scroller;

	if (!this.settings.fullsize) {
		scroller = this.container;
	} else {
		scroller = window;
	}

	scroller.removeEventListener("scroll", this._onScroll);
	this._onScroll = undefined;
}

