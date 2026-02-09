import Mapping from "../../../mapping";
import Snap from "../../helpers/snap";

export function bounds() {
	var bounds;

	bounds = this.stage.bounds();

	return bounds;
}

export function applyLayout(layout) {
	this.layout = layout;
	this.updateLayout();
	if (this.views && this.views.length > 0 && this.layout.name === "pre-paginated") {
		this.display(this.views.first().section);
	}
	// this.manager.layout(this.layout.format);
}

export function updateLayout() {
	if (!this.stage) {
		return;
	}

	this._stageSize = this.stage.size();

	if (!this.isPaginated) {
		this.layout.calculate(this._stageSize.width, this._stageSize.height);
	} else {
		this.layout.calculate(
			this._stageSize.width,
			this._stageSize.height,
			this.settings.gap,
			this.settings.maxColumnCount
		);

		// Set the look ahead offset for what is visible
		this.settings.offset = this.layout.delta / this.layout.divisor;

		// this.stage.addStyleRules("iframe", [{"margin-right" : this.layout.gap + "px"}]);
	}

	// Set the dimensions for views
	this.viewSettings.width = this.layout.width;
	this.viewSettings.height = this.layout.height;

	this.setLayout(this.layout);
}

export function setLayout(layout) {
	this.viewSettings.layout = layout;

	this.mapping = new Mapping(layout.props, this.settings.direction, this.settings.axis);

	if (this.views) {
		this.views.forEach(function (view) {
			if (view) {
				view.setLayout(layout);
			}
		});
	}
}

export function updateWritingMode(mode) {
	this.writingMode = mode;
}

export function updateAxis(axis, forceUpdate?) {
	if (!forceUpdate && axis === this.settings.axis) {
		return;
	}

	this.settings.axis = axis;

	this.stage && this.stage.axis(axis);

	this.viewSettings.axis = axis;

	if (this.mapping) {
		this.mapping = new Mapping(this.layout.props, this.settings.direction, this.settings.axis);
	}

	if (this.layout) {
		if (axis === "vertical") {
			this.layout.spread("none");
		} else {
			this.layout.spread(this.layout.settings.spread);
		}
	}
}

export function updateFlow(flow, defaultScrolledOverflow = "auto") {
	if (this.rendered && this.snapper) {
		this.snapper.destroy();
		this.snapper = undefined;
	}

	let isPaginated = flow === "paginated" || flow === "auto";

	this.isPaginated = isPaginated;

	if (flow === "scrolled-doc" || flow === "scrolled-continuous" || flow === "scrolled") {
		this.updateAxis("vertical");
	} else {
		this.updateAxis("horizontal");
	}

	this.viewSettings.flow = flow;

	if (!this.settings.overflow) {
		this.overflow = isPaginated ? "hidden" : defaultScrolledOverflow;
	} else {
		this.overflow = this.settings.overflow;
	}

	this.stage && this.stage.overflow(this.overflow);

	this.updateLayout();

	if (this.rendered && this.isPaginated && this.settings.snap) {
		this.snapper = new Snap(
			this,
			this.settings.snap &&
				typeof this.settings.snap === "object" &&
				this.settings.snap
		);
	}
}

