export function pdfjsLib() {
	if (this.settings.pdfjs) {
		return this.settings.pdfjs;
	}

	if (typeof globalThis !== "undefined" && globalThis.pdfjsLib) {
		return globalThis.pdfjsLib;
	}
}

export function pdfjsViewer() {
	if (this.settings.pdfjsViewer) {
		return this.settings.pdfjsViewer;
	}

	if (typeof globalThis !== "undefined" && globalThis.pdfjsViewer) {
		return globalThis.pdfjsViewer;
	}
}

export async function open(input) {
	const pdfjs = this.pdfjsLib();
	if (!pdfjs || typeof pdfjs.getDocument !== "function") {
		throw new Error("pdfjsLib is required to open PDFs");
	}

	if (this.settings.workerSrc && pdfjs.GlobalWorkerOptions) {
		pdfjs.GlobalWorkerOptions.workerSrc = this.settings.workerSrc;
	}

	const documentOptions: any = {
		password: this.settings.password,
		withCredentials: this.settings.withCredentials,
		httpHeaders: this.settings.httpHeaders,
	};

	if (typeof input === "string") {
		documentOptions.url = input;
	} else if (input instanceof Blob) {
		const useRangeTransport =
			pdfjs.PDFDataRangeTransport &&
			typeof input.size === "number" &&
			input.size > 0 &&
			typeof input.slice === "function";

		if (useRangeTransport) {
			const transport = new pdfjs.PDFDataRangeTransport(input.size, []);
			transport.requestDataRange = (begin, end) => {
				input
					.slice(begin, end)
					.arrayBuffer()
					.then((chunk) => {
						transport.onDataRange(begin, chunk);
					})
					.catch((error) => {
						try {
							transport.onError(error);
						} catch (e) {
							// NOOP
						}
					});
			};

			documentOptions.range = transport;
		} else {
			const buffer = await input.arrayBuffer();
			documentOptions.data = buffer;
		}
	} else if (input instanceof ArrayBuffer) {
		documentOptions.data = input;
	} else if (input && typeof input.buffer === "object") {
		const data = input instanceof Uint8Array ? input : new Uint8Array(input);
		documentOptions.data = data;
	} else {
		throw new Error("Unsupported PDF input");
	}

	if (typeof this.settings.isEvalSupported === "boolean") {
		documentOptions.isEvalSupported = this.settings.isEvalSupported;
	}

	if (this.settings.cMapUrl && typeof this.settings.cMapUrl === "string") {
		documentOptions.cMapUrl = this.settings.cMapUrl;
	}

	if (typeof this.settings.cMapPacked === "boolean") {
		documentOptions.cMapPacked = this.settings.cMapPacked;
	}

	if (
		this.settings.standardFontDataUrl &&
		typeof this.settings.standardFontDataUrl === "string"
	) {
		documentOptions.standardFontDataUrl = this.settings.standardFontDataUrl;
	}

	const loadingTask = pdfjs.getDocument(documentOptions);

	this.pdf = await loadingTask.promise;
	this.numPages = this.pdf.numPages;

	try {
		await this.initProgressWeights();
	} catch (e) {
		// NOOP
	}

	this.buildSpine();

	await this.loadMetadata();
	await this.loadNavigation();

	this.isOpen = true;
	this.opening.resolve(this);
	return this;
}

