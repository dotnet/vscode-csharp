/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Yield statements", () => {
        it("yield return", () => {
            const input = Input.InMethod(`yield return 42;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Yield,
                Token.Keywords.Return,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.Semicolon
            ]);
        });

        it("yield break", () => {
            const input = Input.InMethod(`yield break;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Yield,
                Token.Keywords.Break,
                Token.Puncuation.Semicolon
            ]);
        });
    });
});