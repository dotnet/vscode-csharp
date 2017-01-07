/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - boolean", () => {
        it("true", () => {

            const input = Input.InClass(`bool x = true;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("bool"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Boolean.True,
                Token.Punctuation.Semicolon]);
        });

        it("false", () => {

            const input = Input.InClass(`bool x = false;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("bool"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Boolean.False,
                Token.Punctuation.Semicolon]);
        });
    });
});