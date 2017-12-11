/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

import { buildPromiseChain, isSubfolderOf, safeLength, sum } from '../../src/common';

import { should } from 'chai';

suite("Common", () => {
    suiteSetup(() => should());

    suite("buildPromiseChain", () => {
        test("produce a sequence of promises", () => {
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

    suite("safeLength", () => {
        test("return 0 for empty array", () => {
            let array = [];
            let result = safeLength(array);
            result.should.equal(0);
        });

        test("returns 5 for array of 5 elements", () => {
            let array = [1, 2, 3, 4, 5];
            let result = safeLength(array);
            result.should.equal(5);
        });

        test("returns 0 for undefined", () => {
            let array = undefined;
            let result = safeLength(array);
            result.should.equal(0);
        });
    });

    suite("sum", () => {
        test("produce total from numbers", () => {
            let array = [1, 2, 3, 4, 5];
            let result = sum(array, i => i);
            result.should.equal(15);
        });

        test("produce total from lengths of arrays", () => {
            let array = [[1, 2], [3], [], [4, 5, 6]];
            let result = sum(array, i => i.length);
            result.should.equal(6);
        });

        test("produce total of true values from array of booleans", () => {
            let array = [true, false, false, true, true, true, false, true];
            let result = sum(array, b => b ? 1 : 0);
            result.should.equal(5);
        });
    });

    suite("isSubfolderOf", () => {
        test("same paths", () => {
            let subfolder: string = ["C:", "temp", "VS", "dotnetProject"].join(path.sep);
            let folder: string= ["C:", "temp", "VS", "dotnetProject"].join(path.sep);
            // tslint:disable-next-line:no-unused-expression
            isSubfolderOf(subfolder, folder).should.be.true;
        });

        test("correct subfolder", () => {
            let subfolder: string = ["C:", "temp", "VS"].join(path.sep);
            let folder: string= ["C:", "temp", "VS", "dotnetProject"].join(path.sep);
            // tslint:disable-next-line:no-unused-expression
            isSubfolderOf(subfolder, folder).should.be.true;
        });

        test("longer subfolder", () => {
            let subfolder: string = ["C:", "temp", "VS", "a", "b", "c"].join(path.sep);
            let folder: string= ["C:", "temp", "VS"].join(path.sep);
            // tslint:disable-next-line:no-unused-expression
            isSubfolderOf(subfolder, folder).should.be.false;
        });

        test("Different drive", () => {
            let subfolder: string = ["C:", "temp", "VS"].join(path.sep);
            let folder: string= ["E:", "temp", "VS"].join(path.sep);
            // tslint:disable-next-line:no-unused-expression
            isSubfolderOf(subfolder, folder).should.be.false;
        });
    });
});
