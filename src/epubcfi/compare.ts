/**
 * Compare which of two CFIs is earlier in the text
 * @returns {number} First is earlier = -1, Second is earlier = 1, They are equal = 0
 */
export function compare(cfiOne, cfiTwo) {
	var stepsA, stepsB;
	var terminalA, terminalB;

	var rangeAStartSteps, rangeAEndSteps;
	var rangeBEndSteps, rangeBEndSteps;
	var rangeAStartTerminal, rangeAEndTerminal;
	var rangeBStartTerminal, rangeBEndTerminal;

	const EpubCFIConstructor = this && this.constructor ? (this.constructor as any) : undefined;

	if(typeof cfiOne === "string") {
		cfiOne = new EpubCFIConstructor(cfiOne);
	}
	if(typeof cfiTwo === "string") {
		cfiTwo = new EpubCFIConstructor(cfiTwo);
	}
	// Compare Spine Positions
	if(cfiOne.spinePos > cfiTwo.spinePos) {
		return 1;
	}
	if(cfiOne.spinePos < cfiTwo.spinePos) {
		return -1;
	}

	if (cfiOne.range) {
		stepsA = cfiOne.path.steps.concat(cfiOne.start.steps);
		terminalA = cfiOne.start.terminal;
	} else {
		stepsA = cfiOne.path.steps;
		terminalA = cfiOne.path.terminal;
	}

	if (cfiTwo.range) {
		stepsB = cfiTwo.path.steps.concat(cfiTwo.start.steps);
		terminalB = cfiTwo.start.terminal;
	} else {
		stepsB = cfiTwo.path.steps;
		terminalB = cfiTwo.path.terminal;
	}

	// Compare Each Step in the First item
	for (var i = 0; i < stepsA.length; i++) {
		if(!stepsA[i]) {
			return -1;
		}
		if(!stepsB[i]) {
			return 1;
		}
		if(stepsA[i].index > stepsB[i].index) {
			return 1;
		}
		if(stepsA[i].index < stepsB[i].index) {
			return -1;
		}
		// Otherwise continue checking
	}

	// All steps in First equal to Second and First is Less Specific
	if(stepsA.length < stepsB.length) {
		return -1;
	}

	// Compare the character offset of the text node
	if(terminalA.offset > terminalB.offset) {
		return 1;
	}
	if(terminalA.offset < terminalB.offset) {
		return -1;
	}

	// CFI's are equal
	return 0;
}

export function equalStep(stepA, stepB) {
	if (!stepA || !stepB) {
		return false;
	}

	if(stepA.index === stepB.index &&
		 stepA.id === stepB.id &&
		 stepA.type === stepB.type) {
		return true;
	}

	return false;
}

