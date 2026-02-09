import EpubCFI from "../epubcfi";

/**
 * Get progress (0..1) for a target without requiring Locations
 * @param {any} target
 * @returns {number | null}
 */
export function getProgressOf(target) {
	const clamp01 = (value) => Math.max(0, Math.min(1, value));

	if (typeof target === "number" && isFinite(target)) {
		return clamp01(target);
	}

	const spineItems = this.spine && this.spine.spineItems ? this.spine.spineItems : [];
	const maxIndex = Math.max(1, spineItems.length - 1);

	if (typeof target === "string") {
		if (this.locations && typeof this.locations.percentageFromCfi === "function") {
			const percentage = this.locations.percentageFromCfi(target);
			if (typeof percentage === "number" && isFinite(percentage)) {
				return clamp01(percentage);
			}
		}

		if (this.epubcfi && this.epubcfi.isCfiString(target)) {
			try {
				const cfi = new EpubCFI(target);
				if (typeof cfi.spinePos === "number" && isFinite(cfi.spinePos)) {
					return clamp01(cfi.spinePos / maxIndex);
				}
			} catch (e) {
				return null;
			}
		}

		const section = this.spine ? this.spine.get(target) : undefined;
		if (section && typeof section.index === "number" && isFinite(section.index)) {
			return clamp01(section.index / maxIndex);
		}
		return null;
	}

	const start = target && target.start ? target.start : undefined;
	if (!start) {
		return null;
	}

	if (typeof start.percentage === "number" && isFinite(start.percentage)) {
		return clamp01(start.percentage);
	}

	if (
		this.locations &&
		typeof this.locations.percentageFromLocation === "function" &&
		typeof start.location === "number" &&
		isFinite(start.location)
	) {
		const percentage = this.locations.percentageFromLocation(start.location);
		if (typeof percentage === "number" && isFinite(percentage)) {
			return clamp01(percentage);
		}
	}

	let index = typeof start.index === "number" && isFinite(start.index) ? start.index : undefined;

	if (typeof index === "undefined" && typeof start.href === "string" && this.spine) {
		const section = this.spine.get(start.href);
		index = section && typeof section.index === "number" ? section.index : undefined;
	}

	if (typeof index !== "number" || !isFinite(index)) {
		return null;
	}

	let fraction = 0;
	const displayed = start.displayed;
	if (displayed && typeof displayed.page === "number" && typeof displayed.total === "number" && displayed.total > 0) {
		fraction = (Math.max(1, displayed.page) - 1) / displayed.total;
	}

	return clamp01((index + clamp01(fraction)) / maxIndex);
}

/**
 * Get the best matching TOC item for a target
 * @param {any} target
 * @returns {any}
 */
export function getTocItemOf(target) {
	const navigation = this.navigation;
	if (!navigation || !Array.isArray(navigation.toc) || navigation.toc.length === 0) {
		return;
	}

	const href =
		typeof target === "string"
			? target
			: target && target.start && typeof target.start.href === "string"
				? target.start.href
				: undefined;

	if (href && typeof navigation.get === "function") {
		const direct = navigation.get(href) || navigation.get(href.split("#")[0]);
		if (direct) {
			return direct;
		}
	}

	const progress = this.getProgressOf(target);
	if (typeof progress !== "number" || !isFinite(progress)) {
		return;
	}

	const flat = [];
	const walk = (items) => {
		if (!Array.isArray(items)) {
			return;
		}
		items.forEach((item) => {
			if (!item) {
				return;
			}
			flat.push(item);
			if (item.subitems && item.subitems.length) {
				walk(item.subitems);
			}
		});
	};
	walk(navigation.toc);

	let best;
	let bestProgress = -Infinity;
	flat.forEach((item) => {
		if (!item || !item.href) {
			return;
		}
		const itemProgress = this.getProgressOf(item.href);
		if (typeof itemProgress !== "number" || !isFinite(itemProgress)) {
			return;
		}
		if (itemProgress <= progress && itemProgress >= bestProgress) {
			best = item;
			bestProgress = itemProgress;
		}
	});

	return best;
}

