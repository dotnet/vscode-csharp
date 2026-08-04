/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import * as path from 'path';

import { isSubfolderOf, safeLength, sum } from '../../../src/common';

describe('Common', () => {
    describe('safeLength', () => {
        test('return 0 for empty array', () => {
            const array: any[] = [];
            const result = safeLength(array);
            expect(result).toBe(0);
        });

        test('returns 5 for array of 5 elements', () => {
            const array = [1, 2, 3, 4, 5];
            const result = safeLength(array);
            expect(result).toBe(5);
        });

        test('returns 0 for undefined', () => {
            const array = undefined;
            const result = safeLength(array);
            expect(result).toBe(0);
        });
    });

    describe('sum', () => {
        test('produce total from numbers', () => {
            const array = [1, 2, 3, 4, 5];
            const result = sum(array, (i) => i);
            expect(result).toBe(15);
        });

        test('produce total from lengths of arrays', () => {
            const array = [[1, 2], [3], [], [4, 5, 6]];
            const result = sum(array, (i) => i.length);
            expect(result).toBe(6);
        });

        test('produce total of true values from array of booleans', () => {
            const array = [true, false, false, true, true, true, false, true];
            const result = sum(array, (b) => (b ? 1 : 0));
            expect(result).toBe(5);
        });
    });

    describe('isSubfolderOf', () => {
        test('same paths', () => {
            const subfolder: string = ['C:', 'temp', 'VS', 'dotnetProject'].join(path.sep);
            const folder: string = ['C:', 'temp', 'VS', 'dotnetProject'].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).toBe(true);
        });

        test('correct subfolder', () => {
            const folder: string = ['C:', 'temp', 'VS'].join(path.sep);
            const subfolder: string = ['C:', 'temp', 'VS', 'dotnetProject'].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).toBe(true);
        });

        test('longer folder', () => {
            const folder: string = ['C:', 'temp', 'VS', 'a', 'b', 'c'].join(path.sep);
            const subfolder: string = ['C:', 'temp', 'VS'].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).toBe(false);
        });

        test('Different drive', () => {
            const subfolder: string = ['C:', 'temp', 'VS'].join(path.sep);
            const folder: string = ['E:', 'temp', 'VS'].join(path.sep);

            expect(isSubfolderOf(subfolder, folder)).toBe(false);
        });
    });
});
