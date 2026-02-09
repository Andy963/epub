// Default Views
import IframeView from "../managers/views/iframe";

// Default View Managers
import DefaultViewManager from "../managers/default/index";
import ContinuousViewManager from "../managers/continuous/index";

/**
 * Set the manager function
 * @param {function} manager
 */
export function setManager(manager) {
	this.manager = manager;
}

/**
 * Require the manager from passed string, or as a class function
 * @param  {string|object} manager [description]
 * @return {method}
 */
export function requireManager(manager) {
	var viewManager;

	// If manager is a string, try to load from imported managers
	if (typeof manager === "string" && manager === "default") {
		viewManager = DefaultViewManager;
	} else if (typeof manager === "string" && manager === "continuous") {
		viewManager = ContinuousViewManager;
	} else {
		// otherwise, assume we were passed a class function
		viewManager = manager;
	}

	return viewManager;
}

/**
 * Require the view from passed string, or as a class function
 * @param  {string|object} view
 * @return {view}
 */
export function requireView(view) {
	var View;

	// If view is a string, try to load from imported views,
	if (typeof view == "string" && view === "iframe") {
		View = IframeView;
	} else {
		// otherwise, assume we were passed a class function
		View = view;
	}

	return View;
}

