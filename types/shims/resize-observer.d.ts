declare type ResizeObserverCallback = (entries: any[], observer: ResizeObserver) => void;

declare interface ResizeObserverObserveOptions {
	box?: "content-box" | "border-box" | "device-pixel-content-box";
}

declare class ResizeObserver {
	constructor(callback: ResizeObserverCallback);
	observe(target: Element, options?: ResizeObserverObserveOptions): void;
	unobserve(target: Element): void;
	disconnect(): void;
}

