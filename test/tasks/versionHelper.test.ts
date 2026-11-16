/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getNextPrereleaseVersion, getNextReleaseVersion } from '../../tasks/snap/snapTasks';
import { describe, test, expect } from '@jest/globals';

describe('getNextReleaseVersion', () => {
    test('advances the prerelease to the next even minor', () => {
        expect(getNextReleaseVersion('11.3')).toBe('11.4');
    });

    test('rejects an even prerelease version', () => {
        expect(() => getNextReleaseVersion('11.2')).toThrow(
            'Cannot advance release from 11.2: prerelease must have an odd minor version.'
        );
    });
});

describe('getNextPrereleaseVersion', () => {
    test('advances main past the intervening stable version', () => {
        expect(getNextPrereleaseVersion('11.3')).toBe('11.5');
    });

    test('rejects an even main version', () => {
        expect(() => getNextPrereleaseVersion('11.2')).toThrow(
            'Cannot advance prerelease from 11.2: main must have an odd minor version.'
        );
    });
});

describe('version parsing', () => {
    test('rejects malformed versions', () => {
        expect(() => getNextReleaseVersion('11.x')).toThrow('Invalid version');
        expect(() => getNextPrereleaseVersion('11.x')).toThrow('Invalid version');
    });
});
