/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as protocol from '../omnisharp/protocol';
import { MarkdownString } from 'vscode';

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

export function GetDocumentationString(structDoc: protocol.DocumentationComment) {
    let newLine = "\n";
    let indentSpaces = "\t";
    let documentation = "";
    if (structDoc == null) {
        return documentation;
    }
    if (structDoc.SummaryText) {
        documentation += structDoc.SummaryText + newLine;
    }

    if (structDoc.TypeParamElements && structDoc.TypeParamElements.length > 0) {
        documentation += "Type Parameters:" + newLine;
        documentation += indentSpaces + structDoc.TypeParamElements.map(displayDocumentationObject).join("\n" + indentSpaces) + newLine;
    }

    if (structDoc.ParamElements && structDoc.ParamElements.length > 0) {
        documentation += "Parameters:" + newLine;
        documentation += indentSpaces + structDoc.ParamElements.map(displayDocumentationObject).join("\n" + indentSpaces) + newLine;
    }

    if (structDoc.ReturnsText) {
        documentation += structDoc.ReturnsText + newLine;
    }

    if (structDoc.RemarksText) {
        documentation += structDoc.RemarksText + newLine;
    }

    if (structDoc.ExampleText) {
        documentation += structDoc.ExampleText + newLine;
    }

    if (structDoc.ValueText) {
        documentation += structDoc.ValueText + newLine;
    }

    if (structDoc.Exception && structDoc.Exception.length > 0) {
        documentation += "Exceptions:" + newLine;
        documentation += indentSpaces + structDoc.Exception.map(displayDocumentationObject).join("\n" + indentSpaces) + newLine;
    }

    documentation = documentation.trim();
    return documentation;
}

export function displayDocumentationObject(obj: protocol.DocumentationItem): string {
    return  obj.Name + ": " + obj.Documentation;
}


export function GetDocumentation1(structDoc: protocol.DocumentationComment) {
    let newLine = "\n";
    let indentSpaces = "\t";
    let documentation : MarkdownString = new MarkdownString("");
    if (structDoc == null) {
        return documentation;
    }
    if (structDoc.SummaryText) {
        documentation.appendMarkdown(structDoc.SummaryText + newLine);
    }

    if (structDoc.TypeParamElements && structDoc.TypeParamElements.length > 0) {
        documentation.appendMarkdown("Type Parameters:" + newLine);
        documentation.appendMarkdown(indentSpaces + structDoc.TypeParamElements.map(displayDocumentationObject).join("\n" + indentSpaces) + newLine);
    }

    if (structDoc.ParamElements && structDoc.ParamElements.length > 0) {
        documentation.appendMarkdown("Parameters:" + newLine);
        documentation.appendMarkdown(indentSpaces + structDoc.ParamElements.map(displayDocumentationObject).join("\n" + indentSpaces) + newLine);
    }

    if (structDoc.ReturnsText) {
        documentation.appendMarkdown(structDoc.ReturnsText + newLine);
    }

    if (structDoc.RemarksText) {
        documentation.appendMarkdown(structDoc.RemarksText + newLine);
    }

    if (structDoc.ExampleText) {
        documentation.appendMarkdown(structDoc.ExampleText + newLine);
    }

    if (structDoc.ValueText) {
        documentation.appendMarkdown(structDoc.ValueText + newLine);
    }

    if (structDoc.Exception && structDoc.Exception.length > 0) {
        documentation.appendMarkdown("Exceptions:" + newLine);
        documentation.appendMarkdown(indentSpaces + structDoc.Exception.map(displayDocumentationObject).join("\n" + indentSpaces) + newLine);
    }
    
    return documentation;
}

