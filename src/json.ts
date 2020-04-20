/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const enum CharCode {
    asterisk = 0x2a,     // *
    backSlash = 0x5c,    // \
    closeBrace = 0x7d,   // }
    closeBracket = 0x5d, // ]
    comma = 0x2c,        // ,
    doubleQuote = 0x22,  // "
    slash = 0x2f,        // /

    byteOrderMark = 0xfeff,

    // line terminator characters (see https://en.wikipedia.org/wiki/Newline#Unicode)
    carriageReturn = 0x0d,
    formFeed = 0x0c,
    lineFeed = 0x0a,
    lineSeparator = 0x2028,
    nextLine = 0x85,
    paragraphSeparator = 0x2029,
    verticalTab = 0x0b,

    // whitespace characters (see https://en.wikipedia.org/wiki/Whitespace_character#Unicode)
    tab = 0x09,
    space = 0x20,
    nonBreakingSpace = 0xa0,
    ogham = 0x1680,
    enQuad = 0x2000,
    emQuad = 0x2001,
    enSpace = 0x2002,
    emSpace = 0x2003,
    threePerEmSpace = 0x2004,
    fourPerEmSpace = 0x2005,
    sixPerEmSpace = 0x2006,
    figureSpace = 0x2007,
    punctuationSpace = 0x2008,
    thinSpace = 0x2009,
    hairSpace = 0x200a,
    zeroWidthSpace = 0x200b,
    narrowNoBreakSpace = 0x202f,
    mathematicalSpace = 0x205f,
    ideographicSpace = 0x3000,
}

function isLineBreak(code: number) {
    return code === CharCode.lineFeed
        || code === CharCode.carriageReturn
        || code === CharCode.verticalTab
        || code === CharCode.formFeed
        || code === CharCode.lineSeparator
        || code === CharCode.paragraphSeparator;
}

function isWhitespace(code: number) {
    return code === CharCode.space
        || code === CharCode.tab
        || code === CharCode.lineFeed
        || code === CharCode.verticalTab
        || code === CharCode.formFeed
        || code === CharCode.carriageReturn
        || code === CharCode.nextLine
        || code === CharCode.nonBreakingSpace
        || code === CharCode.ogham
        || (code >= CharCode.enQuad && code <= CharCode.zeroWidthSpace)
        || code === CharCode.lineSeparator
        || code === CharCode.paragraphSeparator
        || code === CharCode.narrowNoBreakSpace
        || code === CharCode.mathematicalSpace
        || code === CharCode.ideographicSpace
        || code === CharCode.byteOrderMark;
}

function cleanJsonText(text: string) {

    let parts: string[] = [];
    let partStart = 0;

    let index = 0;
    let length = text.length;

    function next(): number | undefined {
        const result = peek();
        index++;
        return result;
    }

    function peek(offset: number = 0): number | undefined {
        if ((index + offset) < length) {
            return text.charCodeAt(index + offset);
        }
        else {
            return undefined;
        }
    }

    function peekPastWhitespace(): number | undefined {
        let pos = index;
        let code = undefined;

        do {
            code = text.charCodeAt(pos);
            pos++;
        }
        while (isWhitespace(code));

        return code;
    }

    function scanString() {
        while (true) {
            if (index >= length) { // string ended unexpectedly
                break;
            }

            let code = next();

            if (code === CharCode.doubleQuote) {
                // End of string. We're done
                break;
            }

            if (code === CharCode.backSlash) {
                // Skip escaped character. We don't care about verifying the escape sequence.
                // We just don't want to accidentally scan an escaped double-quote as the end of the string.
                index++;
            }

            if (isLineBreak(code)) {
                // string ended unexpectedly
                break;
            }
        }
    }

    while (true) {
        let code = next();

        switch (code) {
            // byte-order mark
            case CharCode.byteOrderMark:
                // We just skip the byte-order mark
                parts.push(text.substring(partStart, index - 1));
                partStart = index;
                break;

            // strings
            case CharCode.doubleQuote:
                scanString();
                break;

            // comments
            case CharCode.slash:
                // Single-line comment
                if (peek() === CharCode.slash) {
                    // Be careful not to include the first slash in the text part.
                    parts.push(text.substring(partStart, index - 1));

                    // Start after the second slash and scan until a line-break character is encountered.
                    index++;
                    while (index < length) {
                        if (isLineBreak(peek())) {
                            break;
                        }

                        index++;
                    }

                    partStart = index;
                }

                // Multi-line comment
                if (peek() === CharCode.asterisk) {
                    // Be careful not to include the first slash in the text part.
                    parts.push(text.substring(partStart, index - 1));

                    // Start after the asterisk and scan until a */ is encountered.
                    index++;
                    while (index < length) {
                        if (peek() === CharCode.asterisk && peek(1) === CharCode.slash) {
                            index += 2;
                            break;
                        }

                        index++;
                    }

                    partStart = index;
                }

                break;

            case CharCode.comma:
                // Ignore trailing commas in object member lists and array element lists
                let nextCode = peekPastWhitespace();
                if (nextCode === CharCode.closeBrace || nextCode === CharCode.closeBracket) {
                    parts.push(text.substring(partStart, index - 1));
                    partStart = index;
                }

                break;
            default:
        }

        if (index >= length && index > partStart) {
            parts.push(text.substring(partStart, length));
            break;
        }
    }

    return parts.join('');
}

export function tolerantParse(text: string) {
    text = cleanJsonText(text);
    return JSON.parse(text);
}
