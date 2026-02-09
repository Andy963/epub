import { EVENTS } from "../utils/constants";

/**
 * Start the rendering
 * @return {Promise} rendering has started
 */
export function start(){
	if (!this.settings.layout && (this.book.package.metadata.layout === "pre-paginated" || this.book.displayOptions.fixedLayout === "true")) {
		this.settings.layout = "pre-paginated";
	}
	switch(this.book.package.metadata.spread) {
		case 'none':
			this.settings.spread = 'none';
			break;
		case 'both':
			this.settings.spread = true;
			break;
	}

	if(!this.manager) {
		this.ViewManager = this.requireManager(this.settings.manager);
		this.View = this.requireView(this.settings.view);

		this.manager = new this.ViewManager({
			view: this.View,
			queue: this.q,
			request: this.book.load.bind(this.book),
			settings: this.settings
		});
	}

	this.direction(this.book.package.metadata.direction || this.settings.defaultDirection);

	// Parse metadata to get layout props
	this.settings.globalLayoutProperties = this.determineLayoutProperties(this.book.package.metadata);

	this.flow(this.settings.globalLayoutProperties.flow);

	this.layout(this.settings.globalLayoutProperties);

	// Listen for displayed views
	this.manager.on(EVENTS.MANAGERS.ADDED, this.afterDisplayed.bind(this));
	this.manager.on(EVENTS.MANAGERS.REMOVED, this.afterRemoved.bind(this));

	// Listen for resizing
	this.manager.on(EVENTS.MANAGERS.RESIZED, this.onResized.bind(this));

	// Listen for rotation
	this.manager.on(EVENTS.MANAGERS.ORIENTATION_CHANGE, this.onOrientationChange.bind(this));

	// Listen for scroll changes
	this.manager.on(EVENTS.MANAGERS.SCROLLED, this.reportLocation.bind(this));

	/**
	 * Emit that rendering has started
	 * @event started
	 * @memberof Rendition
	 */
	this.emit(EVENTS.RENDITION.STARTED);

	// Start processing queue
	this.starting.resolve();
}

/**
 * Call to attach the container to an element in the dom
 * Container must be attached before rendering can begin
 * @param  {element} element to attach to
 * @return {Promise}
 */
export function attachTo(element){
	return this.q.enqueue(function () {

		// Start rendering
		this.manager.render(element, {
			"width"  : this.settings.width,
			"height" : this.settings.height
		});

		/**
		 * Emit that rendering has attached to an element
		 * @event attached
		 * @memberof Rendition
		 */
		this.emit(EVENTS.RENDITION.ATTACHED);

	}.bind(this));
}

