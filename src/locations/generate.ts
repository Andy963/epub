export function generate(chars, options?) {
	if (options && options.useWorker) {
		return this.generateWithWorker(chars, options);
	}

	if (chars) {
		this.break = chars;
	}

	this.q.pause();

	this.spine.each(function(section) {
		if (section.linear) {
			this.q.enqueue(this.process.bind(this), section);
		}
	}.bind(this));

	return this.q.run().then(function() {
		this.total = this._locations.length - 1;

		if (this._currentCfi) {
			this.currentLocation = this._currentCfi;
		}

		return this._locations;
		// console.log(this.percentage(this.book.rendition.location.start), this.percentage(this.book.rendition.location.end));
	}.bind(this));
}

export function generateWithWorker(chars, options) {
	if (chars) {
		this.break = chars;
	}

	let worker = options && options.worker;
	let shouldTerminate = false;

	if (!worker) {
		worker = this.createLocationsWorker();
		shouldTerminate = true;
	} else {
		this.attachWorker(worker);
	}

	if (!worker) {
		return this.generate(chars);
	}

	this.worker = worker;

	this.q.pause();

	this.spine.each(function(section) {
		if (section.linear) {
			this.q.enqueue(this.processInWorker.bind(this), section, worker);
		}
	}.bind(this));

	return this.q.run().then(function() {
		this.total = this._locations.length - 1;

		if (this._currentCfi) {
			this.currentLocation = this._currentCfi;
		}

		if (shouldTerminate) {
			worker.terminate();
			if (this.worker === worker) {
				this.worker = undefined;
			}
		}

		return this._locations;
	}.bind(this)).catch((error) => {
		if (shouldTerminate && worker) {
			worker.terminate();
			if (this.worker === worker) {
				this.worker = undefined;
			}
		}

		throw error;
	});
}

