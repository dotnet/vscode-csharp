/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - boolean", () => {
        it("true", () => {

            const input = Input.InClass(`bool x = true;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("bool"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Semicolon]);
        });

        it("false", () => {

            const input = Input.InClass(`bool x = false;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("bool"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Boolean.False,
                Tokens.Puncuation.Semicolon]);
        });
    });
});