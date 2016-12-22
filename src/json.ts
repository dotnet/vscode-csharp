/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const enum CharCode {
    lineFeed = 0x0a,
    carriageReturn = 0x0d,
    lineSeparator = 0x2028,
    paragraphSeparator = 0x2029,

    asterisk = 0x2a,
    backSlash = 0x5c,
    doubleQuote = 0x22,
    slash = 0x2f,
}

function isLineBreak(code: number) {
    return code === CharCode.lineFeed
        || code === CharCode.carriageReturn
        || code === CharCode.lineSeparator
        || code === CharCode.paragraphSeparator;
}

function stripComments(text: string) {

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
        }

        if (index >= length && index > partStart) {
            parts.push(text.substring(partStart, length));
            break;
        }
    }

    return parts.join('');
}

export function tolerantParse(text: string) {
    text = stripComments(text);
    return JSON.parse(text);
}
