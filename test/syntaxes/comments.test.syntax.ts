/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Comments", () => {
        it("single-line comment", () => {

            const input = `// foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("single-line comment after whitespace", () => {

            const input = `    // foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.LeadingWhitespace("    "),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("multi-line comment", () => {

            const input = `/* foo */`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.Text(" foo "),
                Token.Comment.MultiLine.End]);
        });
    });
});