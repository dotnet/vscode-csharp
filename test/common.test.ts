/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { buildPromiseChain } from '../src/common';

suite("Common", () => {
    before(() => should);

    test("buildPromiseChain produces a sequence of promises", () => {
        let array: number[] = [];
        let items = [1, 2, 3, 4, 5];

        let promise = buildPromiseChain(items, n => new Promise((resolve, reject) => {
            array.push(n);
            resolve();
        }));

        return promise.then(() => {
            array.should.deep.equal([1, 2, 3, 4, 5]);
        });
    });
});
