/// <reference path="./shims/event-emitter.d.ts" />
/// <reference path="./shims/marks-pane.d.ts" />
/// <reference path="./shims/path-webpack.d.ts" />
/// <reference path="./shims/jszip-dist-jszip.d.ts" />

// Type definitions for epubjs 0.3
// Project: https://github.com/futurepress/epub.js#readme
// Definitions by: Fred Chasen <https://github.com/fchasen>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
import Epub from "./epub";

export as namespace ePub;

export default Epub;

export { default as Book } from './book';
export { default as PdfBook } from './pdfbook';
export { default as EpubCFI } from './epubcfi';
export { default as Rendition, Location } from './rendition';
export { default as Contents } from './contents';
export { default as Layout } from './layout';
export { NavItem } from './navigation';
export {
  SpeechAnchor,
  SpeechSegment,
  SpeechSegmentationBudget,
  SpeechSegmentationOptions,
  SpeechSegmentationInput,
  speechAnchorFromRange,
  speechAnchorToRange,
  speechSegmentsFromDocument,
} from './read-aloud';

export {
  PlaybackState,
  PlaybackControllerEvents,
  PlaybackControllerDriver,
  PlaybackControllerOptions,
  PlaybackController,
} from './playback-controller';

export {
  SpeechHighlighterOptions,
  SpeechHighlighter,
  createSpeechHighlighter,
} from './speech-highlighter';

declare namespace ePub {

}
