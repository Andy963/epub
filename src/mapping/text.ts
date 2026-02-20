export function walkTextNodes(root: any, func: (node: any) => any): any {
	// IE11 has strange issue, if root is text node IE throws exception on
	// calling treeWalker.nextNode(), saying
	// Unexpected call to method or property access instead of returning null value
	if (root && root.nodeType === Node.TEXT_NODE) {
		return;
	}
	// safeFilter is required so that it can work in IE as filter is a function for IE
	// and for other browser filter is an object.
	var filter = {
		acceptNode: function (node) {
			if (node.data.trim().length > 0) {
				return NodeFilter.FILTER_ACCEPT;
			} else {
				return NodeFilter.FILTER_REJECT;
			}
		},
	};
	var safeFilter: any = filter.acceptNode;
	safeFilter.acceptNode = filter.acceptNode;

	const doc = root && (root.ownerDocument || root);
	if (!doc || typeof doc.createTreeWalker !== "function") {
		return;
	}

	var treeWalker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, safeFilter as any, false);
	var node;
	var result;
	while ((node = treeWalker.nextNode())) {
		result = func(node);
		if (result) break;
	}

	return result;
}

export function splitTextNodeIntoRanges(node: any, splitter?: string): Range[] {
	var ranges = [];
	var textContent = node.textContent || "";
	var text = textContent.trim();
	var range;
	var doc = node.ownerDocument;
	var split = splitter || " ";

	var pos = text.indexOf(split);

	if (pos === -1 || node.nodeType != Node.TEXT_NODE) {
		range = doc.createRange();
		range.selectNodeContents(node);
		return [range];
	}

	range = doc.createRange();
	range.setStart(node, 0);
	range.setEnd(node, pos);
	ranges.push(range);
	range = false;

	while (pos != -1) {
		pos = text.indexOf(split, pos + 1);
		if (pos > 0) {
			if (range) {
				range.setEnd(node, pos);
				ranges.push(range);
			}

			range = doc.createRange();
			range.setStart(node, pos + 1);
		}
	}

	if (range) {
		range.setEnd(node, text.length);
		ranges.push(range);
	}

	return ranges;
}
