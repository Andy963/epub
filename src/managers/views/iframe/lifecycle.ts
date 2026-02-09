import { revokeBlobUrl } from "../../../utils/core";

export function destroy() {
	this.disableSelectionScrollLock();

	for (let cfiRange in this.highlights) {
		this.unhighlight(cfiRange);
	}

	for (let cfiRange in this.underlines) {
		this.ununderline(cfiRange);
	}

	for (let cfiRange in this.marks) {
		this.unmark(cfiRange);
	}

	if (this.blobUrl) {
		revokeBlobUrl(this.blobUrl);
	}

	if(this.displayed){
		this.displayed = false;

		this.removeListeners();
		this.contents.destroy();

		this.stopExpanding = true;
		this.element.removeChild(this.iframe);

		if (this.pane) {
			this.pane.element.remove();
			this.pane = undefined;
		}

		this.iframe = undefined;
		this.contents = undefined;

		this._textWidth = null;
		this._textHeight = null;
		this._width = null;
		this._height = null;
	}

	// this.element.style.height = "0px";
	// this.element.style.width = "0px";
}

