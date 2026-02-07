import Book from "./book";
import Rendition from "./rendition";
import CFI from "./epubcfi";
import Contents from "./contents";
import * as utils from "./utils/core";
import { EPUBJS_VERSION } from "./utils/constants";
import PdfBook from "./pdf/book";

import IframeView from "./managers/views/iframe";
import DefaultViewManager from "./managers/default";
import ContinuousViewManager from "./managers/continuous";

/**
 * Creates a new Book
 * @param {string|ArrayBuffer} url URL, Path or ArrayBuffer
 * @param {object} options to pass to the book
 * @returns {Book} a new Book object
 * @example ePub("/path/to/book.epub", {})
 */
function ePub(url, options) {
	return new Book(url, options);
}

const ePubAny = ePub as any;

ePubAny.VERSION = EPUBJS_VERSION;

if (typeof(global) !== "undefined") {
	(global as any).EPUBJS_VERSION = EPUBJS_VERSION;
}

ePubAny.Book = Book;
ePubAny.PdfBook = PdfBook;
ePubAny.pdf = function(url, options) {
	return new PdfBook(url, options);
};
ePubAny.Rendition = Rendition;
ePubAny.Contents = Contents;
ePubAny.CFI = CFI;
ePubAny.utils = utils;

export default ePub;
