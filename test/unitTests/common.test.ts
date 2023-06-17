/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

import { isSubfolderOf, safeLength, sum } from '../../src/common';

import { should, expect } from 'chai';

suite("Common", () => {
    suiteSetup(() => should());

    suite("safeLength", () => {
        test("return 0 for empty array", () => {
            const array: any[] = [];
            const result = safeLength(array);
            result.should.equal(0);
        });

        test("returns 5 for array of 5 elements", () => {
            const array = [1, 2, 3, 4, 5];
            const result = safeLength(array);
            result.should.equal(5);
        });

        test("returns 0 for undefined", () => {
            const array = undefined;
            const result = safeLength(array);
            result.should.equal(0);
        });
    });

    suite("sum", () => {
        test("produce total from numbers", () => {
            const array = [1, 2, 3, 4, 5];
            const result = sum(array, i => i);
            result.should.equal(15);
        });

        test("produce total from lengths of arrays", () => {
            const array = [[1, 2], [3], [], [4, 5, 6]];
            const result = sum(array, i => i.length);
            result.should.equal(6);
        });

        test("produce total of true values from array of booleans", () => {
            const array = [true, false, false, true, true, true, false, true];
            const result = sum(array, b => b ? 1 : 0);
            result.should.equal(5);
        });
    });

    suite("isSubfolderOf", () => {
        test("same paths", () => {
            const subfolder: string = ["C:", "temp", "VS", "dotnetProject"].join(path.sep);
            const folder: string = ["C:", "temp", "VS", "dotnetProject"].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).to.be.true;
        });

        test("correct subfolder", () => {
            const subfolder: string = ["C:", "temp", "VS"].join(path.sep);
            const folder: string = ["C:", "temp", "VS", "dotnetProject"].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).to.be.true;
        });

        test("longer subfolder", () => {
            const subfolder: string = ["C:", "temp", "VS", "a", "b", "c"].join(path.sep);
            const folder: string = ["C:", "temp", "VS"].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).to.be.false;
        });

        test("Different drive", () => {
            const subfolder: string = ["C:", "temp", "VS"].join(path.sep);
            const folder: string = ["E:", "temp", "VS"].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).to.be.false;
        });
    });
});
