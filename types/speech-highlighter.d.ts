import type Rendition from "./rendition";
import type { SpeechSegment, IgnoreClass } from "./read-aloud";
import type { PlaybackControllerEvents } from "./playback-controller";

export interface SpeechHighlighterOptions {
  className?: string;
  ignoreClass?: IgnoreClass;
  highlightStyle?: Partial<CSSStyleDeclaration> | Record<string, string>;
  scroll?: boolean;
}

export declare class SpeechHighlighter {
  constructor(rendition: Rendition, options?: SpeechHighlighterOptions);

  get ignore(): IgnoreClass;

  highlight(segment: SpeechSegment | null, options?: { scroll?: boolean }): Promise<void>;
  stop(): void;
  clear(): void;
  destroy(): void;

  createPlaybackControllerEvents(segments: SpeechSegment[]): PlaybackControllerEvents;
}

export declare function createSpeechHighlighter(rendition: Rendition, options?: SpeechHighlighterOptions): SpeechHighlighter;

