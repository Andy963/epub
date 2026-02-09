export type SpeechAnchor = string;

export interface SpeechSegment {
  spineIndex: number;
  href: string;
  anchor: SpeechAnchor;
  text: string;
}

export type IgnoreClass = string | ((node: Node) => boolean);

export function speechAnchorFromRange(range: Range, cfiBase: string | object, ignoreClass?: IgnoreClass): SpeechAnchor;

export function speechAnchorToRange(anchor: SpeechAnchor, doc: Document, ignoreClass?: IgnoreClass): Range;

export interface SpeechSegmentationBudget {
  maxChars?: number;
  maxSentences?: number;
}

export interface SpeechSegmentationOptions extends SpeechSegmentationBudget {
  locales?: string | string[];
  ignoreClass?: IgnoreClass;
  root?: Element | null;
  mergeAcrossBlocks?: boolean;
  blockTagNames?: string[];
  excludedTagNames?: string[];
  transformText?: (text: string) => string;
}

export interface SpeechSegmentationInput {
  spineIndex: number;
  href: string;
  cfiBase: string | object;
}

export function speechSegmentsFromDocument(
  doc: Document,
  input: SpeechSegmentationInput,
  options?: SpeechSegmentationOptions
): SpeechSegment[];
