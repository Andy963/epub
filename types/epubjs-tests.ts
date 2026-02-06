import ePub, { Book } from '../';

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
