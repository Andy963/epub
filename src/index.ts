import Book from "./book";
import EpubCFI from "./epubcfi";
import Rendition from "./rendition";
import Contents from "./contents";
import Layout from "./layout";
import ePub from "./epub";
import PdfBook from "./pdf/book";
import { speechAnchorFromRange, speechAnchorToRange, speechSegmentsFromDocument } from "./read-aloud";
import type {
	SpeechAnchor,
	SpeechSegment,
	SpeechSegmentationBudget,
	SpeechSegmentationOptions,
	SpeechSegmentationInput,
} from "./read-aloud";
import { PlaybackController } from "./playback-controller";
import type { PlaybackControllerDriver, PlaybackControllerEvents, PlaybackControllerOptions, PlaybackState } from "./playback-controller";
import { createSpeechHighlighter, SpeechHighlighter } from "./speech-highlighter";
import type { SpeechHighlighterOptions } from "./speech-highlighter";

export default ePub;
export {
	Book,
	PdfBook,
	EpubCFI,
	Rendition,
	Contents,
	Layout,
	speechAnchorFromRange,
	speechAnchorToRange,
	speechSegmentsFromDocument,
	PlaybackController,
	createSpeechHighlighter,
	SpeechHighlighter,
};

export type { SpeechAnchor, SpeechSegment };
export type { SpeechSegmentationBudget, SpeechSegmentationOptions, SpeechSegmentationInput };
export type { PlaybackControllerDriver, PlaybackControllerEvents, PlaybackControllerOptions, PlaybackState };
export type { SpeechHighlighterOptions };
