/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Tokenizer, Token } from './tokenizer';

export class TokenizerUtil
{
    private static _tokenizer: Tokenizer = new Tokenizer("syntaxes/csharp2.json");

    public static tokenize(input: string, excludeTypes: boolean = true): Token[] {
        return TokenizerUtil._tokenizer.tokenize(input, excludeTypes);
    }
}
