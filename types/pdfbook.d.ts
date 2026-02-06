import Rendition, { RenditionOptions } from "./rendition";
import Spine from "./spine";

export interface PdfBookOptions {
  pdfjs?: any,
  workerSrc?: string,
  password?: string,
  withCredentials?: boolean,
  httpHeaders?: Record<string, string>,
  renderScale?: number
}

export default class PdfBook {
  constructor(url?: string | ArrayBuffer | Blob, options?: PdfBookOptions);
  constructor(options?: PdfBookOptions);

  opened: Promise<PdfBook>;
  ready: Promise<PdfBook>;
  isOpen: boolean;
  numPages: number;
  spine: Spine;

  open(input: string | ArrayBuffer | Blob): Promise<PdfBook>;
  section(target: string | number): any;
  renderTo(element: Element | string, options?: RenditionOptions): Rendition;
  destroy(): void;
}

