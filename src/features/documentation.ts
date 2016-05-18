/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const summaryStartTag = /<summary>/i;
const summaryEndTag = /<\/summary>/i;

export function extractSummaryText(xmlDocComment: string): string {
	if (!xmlDocComment) {
		return xmlDocComment;
	}
	
	let summary = xmlDocComment;
	
	let startIndex = summary.search(summaryStartTag);
	if (startIndex < 0) {
		return summary;
	}
	
	summary = summary.slice(startIndex + '<summary>'.length);
	
	let endIndex = summary.search(summaryEndTag);
	if (endIndex < 0) {
		return summary;
	}
	
	return summary.slice(0, endIndex);
}
