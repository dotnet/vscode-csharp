/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Comments", () => {
        it("single-line comment", () => {

            const input = `// foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Comment.SingleLine.Start,
                Tokens.Comment.SingleLine.Text(" foo")]);
        });

        it("single-line comment after whitespace", () => {

            const input = `    // foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Comment.LeadingWhitespace("    "),
                Tokens.Comment.SingleLine.Start,
                Tokens.Comment.SingleLine.Text(" foo")]);
        });

        it("multi-line comment", () => {

            const input = `/* foo */`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.Text(" foo "),
                Tokens.Comment.MultiLine.End]);
        });
    });
});