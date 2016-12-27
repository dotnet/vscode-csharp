/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("Event", function() {
        it("declaration", function() {

const input = `
public class Tester
{
    public event Type Event;
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("event", 4, 12));
            tokens.should.contain(Tokens.Type("Type", 4, 18));
            tokens.should.contain(Tokens.EventIdentifier("Event", 4, 23));
        });

        it("generic", function () {

            const input = `
public class Tester
{
    public event EventHandler<List<T>, Dictionary<T, D>> Event;
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("event", 4, 12));
            tokens.should.contain(Tokens.Type("EventHandler", 4, 18));
            tokens.should.contain(Tokens.Type("List<T>", 4, 31));
            tokens.should.contain(Tokens.Type("Dictionary<T, D>", 4, 40));
            tokens.should.contain(Tokens.EventIdentifier("Event", 4, 58));
        });
    });
});


