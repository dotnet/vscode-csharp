/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { isValidDownload } from '../../../src/packageManager/isValidDownload';
import { EventStream } from '../../../src/eventStream';

describe(`${isValidDownload.name}`, () => {
    const sampleBuffer = Buffer.from('sampleBuffer');
    const validIntegrity = 'eb7201b5d986919e0ac67c820886358869d8f7059193d33c902ad7fe1688e1e9';

    test('Returns false for non-matching integrity', async () => {
        const result = await isValidDownload(sampleBuffer, 'inValidIntegrity', new EventStream());
        expect(result).toBe(false);
    });

    test('Returns true for matching integrity', async () => {
        const result = await isValidDownload(sampleBuffer, validIntegrity, new EventStream());
        expect(result).toBe(true);
    });

    test('Returns true if no integrity has been specified', async () => {
        const result = await isValidDownload(sampleBuffer, undefined, new EventStream());
        expect(result).toBe(true);
    });
});
