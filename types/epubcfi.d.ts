interface EpubCFISegment {
  steps: Array<object>,
  terminal: {
    offset: number,
    assertion: string
  }
}

interface EpubCFIStep {
	id: string,
	tagName: string,
	type: number,
	index: number
}

interface EpubCFIComponent {
  steps: Array<EpubCFIStep>,
  terminal: {
    offset: number,
    assertion: string
  }
}

export default class EpubCFI {
    constructor(cfiFrom?: string | Range | Node, base?: string | object, ignoreClass?: string | ((node: Node) => boolean));

    base: EpubCFIComponent;
		spinePos: number;
		range: boolean;

    isCfiString(str: string): boolean;

    fromNode(anchor: Node, base: string | object, ignoreClass?: string | ((node: Node) => boolean)): EpubCFI;

    fromRange(range: Range, base: string | object, ignoreClass?: string | ((node: Node) => boolean)): EpubCFI;

    parse(cfiStr: string): EpubCFI;

    collapse(toStart?: boolean): void;

    compare(cfiOne: string | EpubCFI, cfiTwo: string | EpubCFI): number;

    equalStep(stepA: object, stepB: object): boolean;

    filter(anchor: Element, ignoreClass?: string | ((node: Node) => boolean)): Element | false;

    toRange(_doc?: Document, ignoreClass?: string | ((node: Node) => boolean)): Range;

    toString(): string;

    private filteredStep(node: Node, ignoreClass?: string | ((node: Node) => boolean)): any;

    private findNode(steps: Array<EpubCFIStep>, _doc?: Document, ignoreClass?: string | ((node: Node) => boolean)): Node;

    private fixMiss(steps: Array<EpubCFIStep>, offset: number, _doc?: Document, ignoreClass?: string | ((node: Node) => boolean)): any;

    private checkType(cfi: string | Range | Node): string | false;

    private generateChapterComponent(_spineNodeIndex: number, _pos: number, id: string): string;

    private getChapterComponent(cfiStr: string): string;

    private getCharecterOffsetComponent(cfiStr: string): string;

    private getPathComponent(cfiStr: string): string;

    private getRange(cfiStr: string): string;

    private joinSteps(steps: Array<EpubCFIStep>): Array<EpubCFIStep>;

    private normalizedMap(children: Array<Node>, nodeType: number, ignoreClass?: string | ((node: Node) => boolean)): object;

    private parseComponent(componentStr: string): object;

    private parseStep(stepStr: string): object;

    private parseTerminal(termialStr: string): object;

    private patchOffset(anchor: Node, offset: number, ignoreClass?: string | ((node: Node) => boolean)): number;

    private pathTo(node: Node, offset: number, ignoreClass?: string | ((node: Node) => boolean)): EpubCFISegment;

    private position(anchor: Node): number;

    private segmentString(segment: EpubCFISegment): string;

    private step(node: Node): EpubCFIStep;

    private stepsToQuerySelector(steps: Array<EpubCFIStep>): string;

    private stepsToXpath(steps: Array<EpubCFIStep>): string;

    private textNodes(container: Node, ignoreClass?: string | ((node: Node) => boolean)): Array<Node>;

    private walkToNode(steps: Array<EpubCFIStep>, _doc?: Document, ignoreClass?: string | ((node: Node) => boolean)): Node;

}
