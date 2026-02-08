import {defer, requestAnimationFrame} from "./core";

type Deferred<T = any> = {
	resolve: (value?: T) => void;
	reject: (reason?: any) => void;
	promise: Promise<T>;
};

/**
 * Queue for handling tasks one at a time
 * @class
 * @param {scope} context what this will resolve to in the tasks
 */
class Queue {
	_q: Array<any>;
	context: any;
	tick: typeof requestAnimationFrame;
	running: Promise<any> | boolean | undefined;
	paused: boolean;
	defered: Deferred<void> | undefined;

	constructor(context: any){
		this._q = [];
		this.context = context;
		this.tick = requestAnimationFrame;
		this.running = false;
		this.paused = false;
	}

	/**
	 * Add an item to the queue
	 * @return {Promise}
	 */
	enqueue(task: any, ...args: any[]): Promise<any> {
		let queued: any;
		if(!task) {
			throw new Error("No Task Provided");
		}

		if(typeof task === "function"){
			const deferred: Deferred<any> = new defer();
			const promise = deferred.promise;

			queued = {
				"task" : task,
				"args"     : args,
				//"context"  : context,
				"deferred" : deferred,
				"promise" : promise
			};

		} else {
			// Task is a promise
			queued = {
				"promise" : task
			};

		}

		this._q.push(queued);

		// Wait to start queue flush
		if (this.paused == false && !this.running) {
			// setTimeout(this.flush.bind(this), 0);
			// this.tick.call(window, this.run.bind(this));
			this.run();
		}

		return queued.promise;
	}

	/**
	 * Run one item
	 * @return {Promise}
	 */
	dequeue(): Promise<any> {
		var inwait, task, result;

		if(this._q.length && !this.paused) {
			inwait = this._q.shift();
			task = inwait.task;
			if(task){
				// console.log(task)

				result = task.apply(this.context, inwait.args);

				if(result && typeof result["then"] === "function") {
					// Task is a function that returns a promise
					return result.then(function(){
						inwait.deferred.resolve.apply(this.context, arguments);
					}.bind(this), function() {
						inwait.deferred.reject.apply(this.context, arguments);
					}.bind(this));
				} else {
					// Task resolves immediately
					inwait.deferred.resolve(result);
					return inwait.promise;
				}



			} else if(inwait.promise) {
				// Task is a promise
				return inwait.promise;
			}

		} else {
			const idle: Deferred<void> = new defer();
			idle.resolve();
			return idle.promise;
		}

	}

	// Run All Immediately
	dump(){
		while(this._q.length) {
			this.dequeue();
		}
	}

	/**
	 * Run all tasks sequentially, at convince
	 * @return {Promise}
	 */
	run(){

		if(!this.running){
			this.running = true;
			this.defered = new defer();
		}

		this.tick.call(window, () => {

			if(this._q.length) {

				this.dequeue()
					.then(function(){
						this.run();
					}.bind(this));

			} else {
				if (this.defered) {
					this.defered.resolve();
				}
				this.running = undefined;
			}

		});

		// Unpause
		if(this.paused == true) {
			this.paused = false;
		}

		return this.defered ? this.defered.promise : Promise.resolve();
	}

	/**
	 * Flush all, as quickly as possible
	 * @return {Promise}
	 */
	flush(){

		if(this.running){
			return this.running;
		}

		if(this._q.length) {
			this.running = this.dequeue()
				.then(function(){
					this.running = undefined;
					return this.flush();
				}.bind(this));

			return this.running;
		}

	}

	/**
	 * Clear all items in wait
	 */
	clear(){
		this._q = [];
	}

	/**
	 * Get the number of tasks in the queue
	 * @return {number} tasks
	 */
	length(){
		return this._q.length;
	}

	/**
	 * Pause a running queue
	 */
	pause(){
		this.paused = true;
	}

	/**
	 * End the queue
	 */
	stop(){
		this._q = [];
		this.running = false;
		this.paused = true;
	}
}


/**
 * Create a new task from a callback
 * @class
 * @private
 * @param {function} task
 * @param {array} args
 * @param {scope} context
 * @return {function} task
 */
class Task {
	constructor(task, args, context){

		return function(){
			var toApply = Array.prototype.slice.call(arguments) as any[];

			return new Promise( (resolve, reject) => {
				var callback = function(value, err){
					if (!value && err) {
						reject(err);
					} else {
						resolve(value);
					}
				};
				// Add the callback to the arguments list
				toApply.push(callback);

				// Apply all arguments to the functions
				task.apply(context || this, toApply);

			});

		};

	}
}


export default Queue;
export { Task };
