import { EVENTS } from "../../../utils/constants";

export function destroy() {
	clearTimeout(this.orientationTimeout);
	clearTimeout(this.resizeTimeout);
	clearTimeout(this.afterScrolled);

	this.clear();

	this.removeEventListeners();

	if (this.snapper) {
		this.snapper.destroy();
		this.snapper = undefined;
	}

	this.stage.destroy();

	this.rendered = false;

	/*

			clearTimeout(this.trimTimeout);
			if(this.settings.hidden) {
				this.element.removeChild(this.wrapper);
			} else {
				this.element.removeChild(this.container);
			}
		*/
}

export function clear() {
	// this.q.clear();

	if (this.views) {
		const removedViews = this.views.slice();
		this.views.hide();
		this.scrollTo(0, 0, true);
		this.views.clear();

		removedViews.forEach((view) => {
			this.emit(EVENTS.MANAGERS.REMOVED, view);
		});
	}
}

export function getContents() {
	var contents = [];
	if (!this.views) {
		return contents;
	}
	this.views.forEach(function (view) {
		const viewContents = view && view.contents;
		if (viewContents) {
			contents.push(viewContents);
		}
	});
	return contents;
}

export function direction(dir = "ltr") {
	this.settings.direction = dir;

	this.stage && this.stage.direction(dir);

	this.viewSettings.direction = dir;

	this.updateLayout();
}

export function isRendered() {
	return this.rendered;
}

