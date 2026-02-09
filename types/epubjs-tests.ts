import ePub, { Book, SpeechSegment, speechAnchorFromRange, speechAnchorToRange, speechSegmentsFromDocument, createSpeechHighlighter, SpeechHighlighter } from '../';

function testEpub() {
  const epub = ePub("https://s3.amazonaws.com/moby-dick/moby-dick.epub");

  const book = new Book("https://s3.amazonaws.com/moby-dick/moby-dick.epub", {});

  const rendition = book.renderTo(document.createElement("div"));
  const location = rendition.currentLocation();

  if (location instanceof Promise) {
    location.then((result) => {
      const href: string = result.start.href;
      const atStart: boolean = result.atStart;

      return [href, atStart];
    });
  } else {
    const href: string = location.start.href;
    const atEnd: boolean = location.atEnd;

    return [href, atEnd];
  }
}

testEpub();

function testReadAloudTypes() {
  const doc = document.implementation.createHTMLDocument("t");
  const el = doc.createElement("p");
  el.textContent = "Hello world. How are you?";
  doc.body.appendChild(el);

  const range = doc.createRange();
  const textNode = el.firstChild as Text;
  range.setStart(textNode, 0);
  range.setEnd(textNode, 5);

  const anchor = speechAnchorFromRange(range, "/6/2[cover]");
  const restored = speechAnchorToRange(anchor, doc);

  const segment: SpeechSegment = {
    spineIndex: 0,
    href: "chapter.xhtml",
    anchor,
    text: restored.toString(),
  };

  const segments: SpeechSegment[] = speechSegmentsFromDocument(doc, {
    spineIndex: 0,
    href: "chapter.xhtml",
    cfiBase: "/6/2[cover]",
  }, {
    maxSentences: 1,
  });

  return [segment, segments];

}

testReadAloudTypes();

function testSpeechHighlighterTypes(rendition: any, segments: SpeechSegment[]) {
  const hl: SpeechHighlighter = createSpeechHighlighter(rendition, {
    className: "my-read-aloud-hl",
    scroll: true,
  });

  const events = hl.createPlaybackControllerEvents(segments);
  events.onSegmentStart && events.onSegmentStart(0);
  events.onStateChange && events.onStateChange("stopped");

  hl.clear();
  hl.destroy();
}
