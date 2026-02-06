import Rendition, { RenditionOptions } from "./rendition";
import Spine from "./spine";
import Navigation from "./navigation";

export interface PdfBookOptions {
  pdfjs?: any,
  workerSrc?: string,
  password?: string,
  withCredentials?: boolean,
  httpHeaders?: Record<string, string>,
  textLayer?: boolean,
  annotationLayer?: boolean,
  renderScale?: number
}

export default class PdfBook {
  constructor(url?: string | ArrayBuffer | Blob, options?: PdfBookOptions);
  constructor(options?: PdfBookOptions);

  opened: Promise<PdfBook>;
  ready: Promise<PdfBook>;
  loaded: {
    metadata: Promise<any>;
    navigation: Promise<Navigation>;
  };
  isOpen: boolean;
  isPdf: boolean;
  numPages: number;
  spine: Spine;
  navigation?: Navigation;

  open(input: string | ArrayBuffer | Blob): Promise<PdfBook>;
  section(target: string | number): any;
  search(query: string, options?: {
    signal?: AbortSignal,
    maxResults?: number,
    excerptLimit?: number,
    onProgress?: (progress: any) => void
  }): Promise<Array<{ sectionIndex: number, href: string, cfi: string, excerpt: string }>>;
  searchText(query: string, options?: {
    signal?: AbortSignal,
    maxResults?: number,
    maxResultsPerSection?: number,
    excerptLimit?: number,
    onProgress?: (progress: any) => void
  }): Promise<Array<{ sectionIndex: number, href: string, matches: Array<{ index: number, excerpt: string }> }>>;
  renderTo(element: Element | string, options?: RenditionOptions): Rendition;
  destroy(): void;
}
