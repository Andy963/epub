export function stepsToXpath(steps) {
	var xpath = [".", "*"];

	steps.forEach(function(step){
		var position = step.index + 1;

		if(step.id){
			xpath.push("*[position()=" + position + " and @id='" + step.id + "']");
		} else if(step.type === "text") {
			xpath.push("text()[" + position + "]");
		} else {
			xpath.push("*[" + position + "]");
		}
	});

	return xpath.join("/");
}

export function stepsToQuerySelector(steps) {
	var query = ["html"];

	steps.forEach(function(step){
		var position = step.index + 1;

		if(step.id){
			query.push("#" + step.id);
		} else if(step.type === "text") {
			// unsupported in querySelector
			// query.push("text()[" + position + "]");
		} else {
			query.push("*:nth-child(" + position + ")");
		}
	});

	return query.join(">");
}

