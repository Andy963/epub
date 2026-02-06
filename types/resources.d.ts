import { PackagingManifestObject } from "./packaging";
import Archive from "./archive";

export default class Resources {
  constructor(manifest: PackagingManifestObject, options: {
    replacements?: string,
    archive?: Archive,
    resolver?: Function,
    request?: Function,
    lazy?: boolean,
    performance?: any
  });

  process(manifest: PackagingManifestObject): void;

  createUrl(url: string): Promise<string>;

  replacements(): Promise<Array<string>>;

  relativeTo(absolute: boolean, resolver?: Function): Array<string>;

  get(path: string): string;

  substitute(content: string, url?: string): string;

  replace(output: string, section: any): Promise<string>;

  unload(parentKey: string): void;

  destroy(): void;

  private split(): void;

  private splitUrls(): void;

  private replaceCss(archive: Archive, resolver?: Function): Promise<Array<string>>;

  private createCssFile(href: string): Promise<string>;
}
