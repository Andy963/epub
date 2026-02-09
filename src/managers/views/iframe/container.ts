export function container(axis) {
	var element = document.createElement("div");

	element.classList.add("epub-view");

	// this.element.style.minHeight = "100px";
	element.style.height = "0px";
	element.style.width = "0px";
	element.style.overflow = "hidden";
	element.style.position = "relative";
	element.style.display = "block";

	if(axis && axis == "horizontal"){
		element.style.flex = "none";
	} else {
		element.style.flex = "initial";
	}

	return element;
}

