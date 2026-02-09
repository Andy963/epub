import { uuid } from "./id";

/**
 * Creates a new pending promise and provides methods to resolve or reject it.
 * From: https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred#backwards_forwards_compatible
 * @memberof Core
 */
export interface Deferred<T = any> {
	resolve: (value?: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
	id: string;
	promise: Promise<T>;
}

export type DeferConstructor = {
	new <T = any>(): Deferred<T>;
};

export const defer: DeferConstructor = function Defer(this: Deferred<any>) {
	/* A method to resolve the associated Promise with the value passed.
	 * If the promise is already settled it does nothing.
	 *
	 * @param {anything} value : This value is used to resolve the promise
	 * If the value is a Promise then the associated promise assumes the state
	 * of Promise passed as value.
	 */
	this.resolve = null as any;

	/* A method to reject the associated Promise with the value passed.
	 * If the promise is already settled it does nothing.
	 *
	 * @param {anything} reason: The reason for the rejection of the Promise.
	 * Generally its an Error object. If however a Promise is passed, then the Promise
	 * itself will be the reason for rejection no matter the state of the Promise.
	 */
	this.reject = null as any;

	this.id = uuid();

	/* A newly created Pomise object.
	 * Initially in pending state.
	 */
	this.promise = new Promise((resolve, reject) => {
		this.resolve = resolve;
		this.reject = reject;
	});
	Object.freeze(this);
} as any;

