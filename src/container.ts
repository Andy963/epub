import path from "path-webpack";
import {qs} from "./utils/core";

/**
 * Handles Parsing and Accessing an Epub Container
 * @class
 * @param {document} [containerDocument] xml document
 */
class Container {
	packagePath: string | undefined;
	directory: string | undefined;
	encoding: string | undefined;

	constructor(containerDocument?: any) {
		this.packagePath = "";
		this.directory = "";
		this.encoding = "";

		if (containerDocument) {
			this.parse(containerDocument);
		}
	}

	/**
	 * Parse the Container XML
	 * @param  {document} containerDocument
	 */
	parse(containerDocument){
		//-- <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
		var rootfile;

		if(!containerDocument) {
			throw new Error("Container File Not Found");
		}

		rootfile = qs(containerDocument, "rootfile");

		if(!rootfile) {
			throw new Error("No RootFile Found");
		}

		const packagePath = rootfile.getAttribute("full-path");
		if (!packagePath) {
			throw new Error("No RootFile Full Path Found");
		}

		this.packagePath = packagePath;
		this.directory = path.dirname(this.packagePath);
		this.encoding = containerDocument.xmlEncoding;
	}

	destroy(): void {
		this.packagePath = undefined;
		this.directory = undefined;
		this.encoding = undefined;
	}
}

export default Container;
