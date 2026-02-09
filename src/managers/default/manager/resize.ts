import { windowBounds } from "../../../utils/core";
import { EVENTS } from "../../../utils/constants";

export function onOrientationChange(e) {
	let { orientation } = window;

	if (this.optsSettings.resizeOnOrientationChange) {
		this.resize();
	}

	// Per ampproject:
	// In IOS 10.3, the measured size of an element is incorrect if the
	// element size depends on window size directly and the measurement
	// happens in window.resize event. Adding a timeout for correct
	// measurement. See https://github.com/ampproject/amphtml/issues/8479
	clearTimeout(this.orientationTimeout);
	this.orientationTimeout = setTimeout(
		function () {
			this.orientationTimeout = undefined;

			if (this.optsSettings.resizeOnOrientationChange) {
				this.resize();
			}

			this.emit(EVENTS.MANAGERS.ORIENTATION_CHANGE, orientation);
		}.bind(this),
		500
	);
}

export function onResized(e) {
	// Resize can race with the initial display / render pipeline since it is
	// triggered from a window event (outside the rendition queue). Queue the
	// actual resize work behind the rendition queue to keep view lifecycle
	// operations ordered and avoid ending up with cleared views and no
	// location to re-display (#1384).
	if (this.renditionQueue) {
		this._resizeNeeded = true;

		if (this._resizeScheduled) {
			return;
		}

		this._resizeScheduled = true;
		this.renditionQueue.enqueue(() => {
			this._resizeScheduled = false;

			if (!this._resizeNeeded) {
				return;
			}

			this._resizeNeeded = false;
			this.resize();
		});

		return;
	}

	this.resize();
}

export function resize(width?, height?, epubcfi?) {
	let stageSize = this.stage.size(width, height);

	// For Safari, wait for orientation to catch up
	// if the window is a square
	this.winBounds = windowBounds();
	if (this.orientationTimeout && this.winBounds.width === this.winBounds.height) {
		// reset the stage size for next resize
		this._stageSize = undefined;
		return;
	}

	if (
		this._stageSize &&
		this._stageSize.width === stageSize.width &&
		this._stageSize.height === stageSize.height
	) {
		// Size is the same, no need to resize
		return;
	}

	this._stageSize = stageSize;

	this._bounds = this.bounds();

	// Clear current views
	this.clear();

	// Update for new views
	this.viewSettings.width = this._stageSize.width;
	this.viewSettings.height = this._stageSize.height;

	this.updateLayout();

	this.emit(
		EVENTS.MANAGERS.RESIZED,
		{
			width: this._stageSize.width,
			height: this._stageSize.height,
		},
		epubcfi
	);
}

