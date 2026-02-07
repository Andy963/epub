import Book, { BookOptions } from "./book";
import PdfBook, { PdfBookOptions } from "./pdfbook";

export default Epub;

declare function Epub(urlOrData: string | ArrayBuffer | Blob, options?: BookOptions) : Book;
declare function Epub(options?: BookOptions) : Book;

declare namespace Epub {
  const Book: typeof Book;
  const PdfBook: typeof PdfBook;
  function pdf(urlOrData?: string | ArrayBuffer | Blob, options?: PdfBookOptions): PdfBook;
}
