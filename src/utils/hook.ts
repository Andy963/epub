/**
 * Hooks allow for injecting functions that must all complete in order before finishing
 * They will execute in parallel but all must finish before continuing
 * Functions may return a promise if they are async.
 * @param {any} context scope of this
 * @example this.content = new EPUBJS.Hook(this);
 */
class Hook {
	context: unknown;
	hooks: Array<(...args: any[]) => unknown>;

	constructor(context?: unknown) {
		this.context = context || this;
		this.hooks = [];
	}

	/**
	 * Adds a function to be run before a hook completes
	 * @example this.content.register(function(){...});
	 */
	register(...items: Array<((...args: any[]) => unknown) | Array<(...args: any[]) => unknown>>): void {
		for (const item of items) {
			if (typeof item === "function") {
				this.hooks.push(item);
				continue;
			}

			// unpack array
			for (const hook of item) {
				this.hooks.push(hook);
			}
		}
	}

	/**
	 * Removes a function
	 * @example this.content.deregister(function(){...});
	 */
	deregister(func: (...args: any[]) => unknown): void {
		let hook;
		for (let i = 0; i < this.hooks.length; i++) {
			hook = this.hooks[i];
			if (hook === func) {
				this.hooks.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * Triggers a hook to run all functions
	 * @example this.content.trigger(args).then(function(){...});
	 */
	trigger(...args: any[]): Promise<unknown[]> {
		const context = this.context;
		const promises: Array<Promise<unknown>> = [];

		this.hooks.forEach(function(task) {
			try {
				const executing = task.apply(context, args);
				if (executing && typeof (executing as any)["then"] === "function") {
					// Task is a function that returns a promise
					promises.push(executing as Promise<unknown>);
				}
			} catch (err) {
				console.log(err);
			}

			// Otherwise Task resolves immediately, continue
		});


		return Promise.all(promises);
	}

	// Adds a function to be run before a hook completes
	list(): Array<(...args: any[]) => unknown> {
		return this.hooks;
	}

	clear(): Array<(...args: any[]) => unknown> {
		this.hooks = [];
		return this.hooks;
	}
}
export default Hook;
