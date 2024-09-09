/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AbsolutePath } from '../../../src/packageManager/absolutePath';
import { TmpAsset, CreateTmpFile } from '../../../src/createTmpAsset';
import { join } from 'path';

describe(AbsolutePath.name, () => {
    let tmpPath: TmpAsset;

    beforeEach(async () => {
        tmpPath = await CreateTmpFile();
    });

    afterEach(() => {
        tmpPath.dispose();
    });

    test('Throws error when the passed value is not an absolute path', () => {
        expect(() => new AbsolutePath('somePath')).toThrow(Error);
    });

    test(`${AbsolutePath.getAbsolutePath.name}: Returns an absolute path based by resolving the path with the value to prepend`, () => {
        const absolutePath = AbsolutePath.getAbsolutePath(tmpPath.name, 'somePath');
        expect(absolutePath.value).toEqual(join(tmpPath.name, 'somePath'));
    });
});
