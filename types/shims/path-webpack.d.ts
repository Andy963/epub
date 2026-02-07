declare module "path-webpack" {
  export interface ParsedPath {
    root: string;
    dir: string;
    base: string;
    ext: string;
    name: string;
  }

  export interface PathAPI {
    resolve(...paths: string[]): string;
    join(...paths: string[]): string;
    normalize(path: string): string;
    isAbsolute(path: string): boolean;
    relative(from: string, to: string): string;
    dirname(p: string): string;
    basename(p: string, ext?: string): string;
    extname(p: string): string;
    format(pathObject: ParsedPath): string;
    parse(path: string): ParsedPath;
    sep: string;
    delimiter: string;
  }

  const path: PathAPI;
  export default path;
}
