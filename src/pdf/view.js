import IframeView from "../managers/views/iframe";

class PdfView extends IframeView {
	size(_width, _height) {
		const width = _width || this.settings.width;
		const height = _height || this.settings.height;

		if (this.shouldUseDynamicHeight()) {
			this.lock("width", width, height);
			this.settings.width = width;
			this.settings.height = height;
			return;
		}

		super.size(_width, _height);
	}

	expand(force) {
		super.expand(force);

		if (!this.iframe || !this.contents || !this.layout) {
			return;
		}

		if (this.layout.name !== "pre-paginated") {
			return;
		}

		if (this.shouldUseDynamicHeight()) {
			const width = this._width;
			if (!width) {
				return;
			}

			const viewport = this.contents.viewport();
			const viewportWidth = parseInt(viewport && viewport.width, 10);
			const viewportHeight = parseInt(viewport && viewport.height, 10);
			if (!viewportWidth || !viewportHeight) {
				return;
			}

			const scale = width / viewportWidth;
			if (!scale || !isFinite(scale)) {
				return;
			}

			const height = Math.ceil(viewportHeight * scale);
			if (!height || !isFinite(height)) {
				return;
			}

			try {
				this.contents.fit(width, height, this.section);
			} catch (e) {
				// NOOP
			}

			this.reframe(width, height);
			return;
		}

		this.centerFixedLayout();
	}

	shouldUseDynamicHeight() {
		if (!this.layout || this.layout.name !== "pre-paginated") {
			return false;
		}

		const flow = typeof this.layout.flow === "function" ? this.layout.flow() : undefined;
		return flow === "scrolled";
	}

	centerFixedLayout() {
		if (!this.contents || typeof this.contents.viewport !== "function") {
			return;
		}

		if (
			this.section &&
			this.section.properties &&
			this.section.properties.includes("page-spread-left")
		) {
			return;
		}

		const viewport = this.contents.viewport();
		const viewportWidth = parseInt(viewport && viewport.width, 10);
		const viewportHeight = parseInt(viewport && viewport.height, 10);
		const width = this.width();
		const height = this.height();

		if (!viewportWidth || !viewportHeight || !width || !height) {
			return;
		}

		const scale = Math.min(width / viewportWidth, height / viewportHeight);
		if (!scale || !isFinite(scale)) {
			return;
		}

		const offsetX = Math.max(0, Math.floor((width - viewportWidth * scale) / 2));
		const offsetY = Math.max(0, Math.floor((height - viewportHeight * scale) / 2));

		this.contents.css("margin-left", `${offsetX}px`);
		this.contents.css("margin-top", `${offsetY}px`);
	}
}

export default PdfView;

