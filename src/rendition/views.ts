import { EVENTS } from "../utils/constants";

/**
 * Report what section has been displayed
 * @private
 * @param  {*} view
 */
export function afterDisplayed(view){
	view.on(EVENTS.VIEWS.MARK_CLICKED, (cfiRange, data) => this.triggerMarkEvent(cfiRange, data, view.contents));

	const onRendered = () => {
		this.emit(EVENTS.RENDITION.RENDERED, view.section, view);

		if (this.book && typeof this.book.pinSection === "function") {
			this.book.pinSection(view.section);
		}

		if (this.book && this.settings.prefetch && typeof this.book.prefetch === "function") {
			this.book.prefetch(view.section, this.settings.prefetch).catch(() => {
				return;
			});
		}
	};

	this.hooks.render.trigger(view, this)
		.then(() => {
			if (view.contents) {
				this.hooks.content.trigger(view.contents, this).then(() => {
					/**
					 * Emit that a section has been rendered
					 * @event rendered
					 * @param {Section} section
					 * @param {View} view
					 * @memberof Rendition
					 */
					onRendered();
				});
			} else {
				onRendered();
			}
		});
}

/**
 * Report what has been removed
 * @private
 * @param  {*} view
 */
export function afterRemoved(view){
	if (this.book && typeof this.book.unpinSection === "function") {
		this.book.unpinSection(view.section);
	}
	if (this.book && this.book.resources && typeof this.book.resources.unload === "function") {
		this.book.resources.unload(view.id);
	}

	this.hooks.unloaded.trigger(view, this).then(() => {
		/**
		 * Emit that a section has been removed
		 * @event removed
		 * @param {Section} section
		 * @param {View} view
		 * @memberof Rendition
		 */
		this.emit(EVENTS.RENDITION.REMOVED, view.section, view);
	});
}

