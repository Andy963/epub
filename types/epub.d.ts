import Book, { BookOptions } from "./book";
import PdfBook, { PdfBookOptions } from "./pdfbook";

export default Epub;

declare function Epub(urlOrData: string | ArrayBuffer | Uint8Array | Blob, options?: BookOptions) : Book;
declare function Epub(options?: BookOptions) : Book;

declare namespace Epub {
  const Book: typeof import("./book").default;
  const PdfBook: typeof import("./pdfbook").default;
  function pdf(
    urlOrData?: string | ArrayBuffer | Uint8Array | Blob,
    options?: PdfBookOptions
  ): import("./pdfbook").default;
}
