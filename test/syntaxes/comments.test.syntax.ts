/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Comments", () => {
        it("single-line comment", () => {

            const input = `
// foo`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Comment.SingleLine.Start(2, 1),
                Tokens.Comment.SingleLine.Text(" foo", 2, 3)]);
        });

        it("single-line comment after whitespace", () => {

            const input = `
    // foo`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Comment.LeadingWhitespace("    ", 2, 1),
                Tokens.Comment.SingleLine.Start(2, 5),
                Tokens.Comment.SingleLine.Text(" foo", 2, 7)]);
        });

        it("multi-line comment", () => {

            const input = `
/* foo */`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Comment.MultiLine.Start(2, 1),
                Tokens.Comment.MultiLine.Text(" foo ", 2, 3),
                Tokens.Comment.MultiLine.End(2, 8)]);
        });
    });
});