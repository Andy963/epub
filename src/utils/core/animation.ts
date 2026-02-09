const coreWindow = typeof window !== "undefined" ? (window as any) : undefined;

/**
 * Vendor prefixed requestAnimationFrame
 * @returns {function} requestAnimationFrame
 * @memberof Core
 */
export const requestAnimationFrame =
	coreWindow
		? coreWindow.requestAnimationFrame ||
			coreWindow.mozRequestAnimationFrame ||
			coreWindow.webkitRequestAnimationFrame ||
			coreWindow.msRequestAnimationFrame
		: false;

