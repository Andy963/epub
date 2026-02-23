import EventEmitter from "event-emitter";
import EpubCFI from "./epubcfi";
import { EVENTS } from "./utils/constants";

type AnnotationType = "highlight" | "underline" | "mark";

/**
 * Handles managing adding & removing Annotations
 * @param {Rendition} rendition
 * @class
 */
class Annotations {
	rendition: any;
	highlights: Annotation[];
	underlines: Annotation[];
	marks: Annotation[];
	_annotations: Record<string, Annotation>;
	_annotationsBySectionIndex: Record<number, string[]>;

	constructor(rendition: any) {
		this.rendition = rendition;
		this.highlights = [];
		this.underlines = [];
		this.marks = [];
		this._annotations = {};
		this._annotationsBySectionIndex = {};

		this.rendition.hooks.render.register(this.inject.bind(this));
		this.rendition.hooks.unloaded.register(this.clear.bind(this));
	}

	private annotationHash(cfiRange: string, type: AnnotationType): string {
		return encodeURI(cfiRange + type);
	}

	/**
	 * Add an annotation to store
	 * @param {string} type Type of annotation to add: "highlight", "underline", "mark"
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} [cb] Callback after annotation is added
	 * @param {string} className CSS class to assign to annotation
	 * @param {object} styles CSS styles to assign to annotation
	 * @returns {Annotation} annotation
	 */
	add(type: AnnotationType, cfiRange: string, data?: any, cb?: any, className?: string, styles?: any): Annotation {
		const hash = this.annotationHash(cfiRange, type);
		const cfi = new EpubCFI(cfiRange);
		const sectionIndex = cfi.spinePos;
		const annotation = new Annotation({
			type,
			cfiRange,
			data,
			sectionIndex,
			cb,
			className,
			styles
		});

		this._annotations[hash] = annotation;

		const existing = this._annotationsBySectionIndex[sectionIndex];
		if (existing) {
			existing.push(hash);
		} else {
			this._annotationsBySectionIndex[sectionIndex] = [hash];
		}

		const views = this.rendition.views();

		views.forEach( (view) => {
			if (annotation.sectionIndex === view.index) {
				annotation.attach(view);
			}
		});

		return annotation;
	}

	/**
	 * Remove an annotation from store
	 * @param {EpubCFI} cfiRange EpubCFI range the annotation is attached to
	 * @param {string} type Type of annotation to add: "highlight", "underline", "mark"
	 */
	remove(cfiRange: string, type: AnnotationType): void {
		const hash = this.annotationHash(cfiRange, type);

		if (Object.prototype.hasOwnProperty.call(this._annotations, hash)) {
			const annotation = this._annotations[hash];

			if (type && annotation.type !== type) {
				return;
			}

			this._removeFromAnnotationBySectionIndex(annotation.sectionIndex, hash);

			const views = this.rendition.views();
			views.forEach((view) => {
				if (annotation.sectionIndex === view.index) {
					annotation.detach(view);
				}
			});

			delete this._annotations[hash];
		}
	}

	/**
	 * Remove an annotations by Section Index
	 * @private
	 */
	private _removeFromAnnotationBySectionIndex(sectionIndex: number, hash: string): void {
		const remaining = this._annotationsAt(sectionIndex).filter((h) => h !== hash);
		if (remaining.length) {
			this._annotationsBySectionIndex[sectionIndex] = remaining;
		} else {
			delete this._annotationsBySectionIndex[sectionIndex];
		}
	}

	/**
	 * Get annotations by Section Index
	 * @private
	 */
	private _annotationsAt(index: number): string[] {
		return this._annotationsBySectionIndex[index] || [];
	}


	/**
	 * Add a highlight to the store
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} cb Callback after annotation is clicked
	 * @param {string} className CSS class to assign to annotation
	 * @param {object} styles CSS styles to assign to annotation
	 */
	highlight(cfiRange: string, data?: any, cb?: any, className?: string, styles?: any): Annotation {
		return this.add("highlight", cfiRange, data, cb, className, styles);
	}

	/**
	 * Add a underline to the store
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} cb Callback after annotation is clicked
	 * @param {string} className CSS class to assign to annotation
	 * @param {object} styles CSS styles to assign to annotation
	 */
	underline(cfiRange: string, data?: any, cb?: any, className?: string, styles?: any): Annotation {
		return this.add("underline", cfiRange, data, cb, className, styles);
	}

	/**
	 * Add a mark to the store
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} cb Callback after annotation is clicked
	 */
	mark(cfiRange: string, data?: any, cb?: any): Annotation {
		return this.add("mark", cfiRange, data, cb);
	}

	/**
	 * iterate over annotations in the store
	 */
	each (callback: (annotation: Annotation, hash: string) => void, thisArg?: any): void {
		Object.keys(this._annotations).forEach((hash) => {
			callback.call(thisArg || this, this._annotations[hash], hash);
		});
	}

	/**
	 * Hook for injecting annotation into a view
	 * @param {View} view
	 * @private
	 */
	private inject(view: any): void {
		const sectionIndex = view.index;
		const hashes = this._annotationsBySectionIndex[sectionIndex];
		if (!hashes || !hashes.length) {
			return;
		}

		hashes.forEach((hash) => {
			const annotation = this._annotations[hash];
			if (annotation) {
				annotation.attach(view);
			}
		});
	}

	/**
	 * Hook for removing annotation from a view
	 * @param {View} view
	 * @private
	 */
	private clear(view: any): void {
		const sectionIndex = view.index;
		const hashes = this._annotationsBySectionIndex[sectionIndex];
		if (!hashes || !hashes.length) {
			return;
		}

		hashes.forEach((hash) => {
			const annotation = this._annotations[hash];
			if (annotation) {
				annotation.detach(view);
			}
		});
	}

	/**
	 * [Not Implemented] Show annotations
	 * @TODO: needs implementation in View
	 */
	show(): void {}

	/**
	 * [Not Implemented] Hide annotations
	 * @TODO: needs implementation in View
	 */
	hide(): void {}

}

interface AnnotationOptions {
	type: AnnotationType;
	cfiRange: string;
	data?: any;
	sectionIndex: number;
	cb?: any;
	className?: string;
	styles?: any;
}

/**
 * Annotation object
 * @class
 * @param {object} options
 * @param {string} options.type Type of annotation to add: "highlight", "underline", "mark"
 * @param {EpubCFI} options.cfiRange EpubCFI range to attach annotation to
 * @param {object} options.data Data to assign to annotation
 * @param {int} options.sectionIndex Index in the Spine of the Section annotation belongs to
 * @param {function} [options.cb] Callback after annotation is clicked
 * @param {string} className CSS class to assign to annotation
 * @param {object} styles CSS styles to assign to annotation
 * @returns {Annotation} annotation
 */
class Annotation {
	type: AnnotationType;
	cfiRange: string;
	data: any;
	sectionIndex: number;
	mark: any;
	cb: any;
	className: string | undefined;
	styles: any;

	on: (event: string, listener: (...args: any[]) => void) => this;
	once: (event: string, listener: (...args: any[]) => void) => this;
	off: (event: string, listener?: (...args: any[]) => void) => this;
	emit: (event: string, ...args: any[]) => boolean;

	constructor({ type, cfiRange, data, sectionIndex, cb, className, styles }: AnnotationOptions) {
		this.type = type;
		this.cfiRange = cfiRange;
		this.data = data;
		this.sectionIndex = sectionIndex;
		this.mark = undefined;
		this.cb = cb;
		this.className = className;
		this.styles = styles;
	}

	/**
	 * Update stored data
	 * @param {object} data
	 */
	update(data: any): void {
		this.data = data;
	}

	/**
	 * Add to a view
	 * @param {View} view
	 */
	attach(view: any): any {
		const { cfiRange, data, type, cb, className, styles } = this;
		let result;

		if (type === "highlight") {
			result = view.highlight(cfiRange, data, cb, className, styles);
		} else if (type === "underline") {
			result = view.underline(cfiRange, data, cb, className, styles);
		} else if (type === "mark") {
			result = view.mark(cfiRange, data, cb);
		}

		this.mark = result;
		this.emit(EVENTS.ANNOTATION.ATTACH, result);
		return result;
	}

	/**
	 * Remove from a view
	 * @param {View} view
	 */
	detach(view: any): any {
		const { cfiRange, type } = this;
		let result;

		if (view) {
			if (type === "highlight") {
				result = view.unhighlight(cfiRange);
			} else if (type === "underline") {
				result = view.ununderline(cfiRange);
			} else if (type === "mark") {
				result = view.unmark(cfiRange);
			}
		}

		this.mark = undefined;
		this.emit(EVENTS.ANNOTATION.DETACH, result);
		return result;
	}

	/**
	 * [Not Implemented] Get text of an annotation
	 * @TODO: needs implementation in contents
	 */
	text(): void {}

}

EventEmitter(Annotation.prototype);


export default Annotations;
