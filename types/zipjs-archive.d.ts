export interface ZipJsArchiveOptions {
  zipjs?: any;
  requestHeaders?: Record<string, string>;
}

export default class ZipJsArchive {
  constructor(options?: ZipJsArchiveOptions);

  open(input: ArrayBuffer | Uint8Array | Blob | string, isBase64?: boolean): Promise<void>;

  openUrl(zipUrl: string, isBase64?: boolean): Promise<void>;

  request(url: string, type?: string): Promise<Blob | string | JSON | Document | XMLDocument>;

  getBlob(url: string, mimeType?: string): Promise<Blob | undefined>;

  getText(url: string, encoding?: string): Promise<string | undefined>;

  getBase64(url: string, mimeType?: string): Promise<string | undefined>;

  createUrl(url: string, options?: { base64?: boolean }): Promise<string>;

  revokeUrl(url: string): void;

  destroy(): Promise<void>;
}

