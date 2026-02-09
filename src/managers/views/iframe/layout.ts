export function setLayout(layout) {
	this.layout = layout;

	if (this.contents) {
		this.layout.format(this.contents, this.section, this.settings.axis);
		this.expand();
	}
}

export function setAxis(axis) {
	this.settings.axis = axis;

	if(axis == "horizontal"){
		this.element.style.flex = "none";
	} else {
		this.element.style.flex = "initial";
	}

	this.size();
}

export function setWritingMode(mode) {
	// this.element.style.writingMode = writingMode;
	this.writingMode = mode;
}

