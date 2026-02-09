export const XLINK_NS = "http://www.w3.org/1999/xlink";

export type Manifest = Record<string, ManifestItem>;

export interface ManifestItem {
	href: string;
	type?: string;
	[key: string]: any;
}

export type ResourcesResolver = (href: string) => string;

export type ResourcesRequester = (url: string, type?: string | null) => Promise<any>;

export interface ResourcesArchive {
	createUrl: (url: string, options?: { base64?: boolean }) => Promise<string>;
	getText: (url: string, encoding?: string) => Promise<string> | undefined;
	getBlob: (url: string, mimeType?: string) => Promise<Blob> | undefined;
	getBase64: (url: string, mimeType?: string) => Promise<string> | undefined;
}

export interface ResourcesSettings {
	replacements?: "none" | "base64" | "blobUrl" | string;
	archive?: ResourcesArchive;
	resolver?: ResourcesResolver;
	request?: ResourcesRequester;
	lazy?: boolean;
	performance?: any;
}

