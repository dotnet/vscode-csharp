/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getNextReleaseVersion } from '../../tasks/snap/snapTasks';
import { describe, test, expect } from '@jest/globals';

describe('getNextReleaseVersion', () => {
    test('rounds up to next tens from single digit minor version', () => {
        expect(getNextReleaseVersion('2.1')).toBe('2.10');
        expect(getNextReleaseVersion('2.5')).toBe('2.10');
        expect(getNextReleaseVersion('2.9')).toBe('2.10');
    });

    test('rounds up to next tens from teens minor version', () => {
        expect(getNextReleaseVersion('2.10')).toBe('2.20');
        expect(getNextReleaseVersion('2.15')).toBe('2.20');
        expect(getNextReleaseVersion('2.19')).toBe('2.20');
    });

    test('rounds up to next tens from twenties minor version', () => {
        expect(getNextReleaseVersion('2.20')).toBe('2.30');
        expect(getNextReleaseVersion('2.25')).toBe('2.30');
        expect(getNextReleaseVersion('2.29')).toBe('2.30');
    });

    test('rounds up from 74 to 80', () => {
        expect(getNextReleaseVersion('2.74')).toBe('2.80');
    });

    test('rounds up from 75 to 80', () => {
        expect(getNextReleaseVersion('2.75')).toBe('2.80');
    });

    test('rounds up from 79 to 80', () => {
        expect(getNextReleaseVersion('2.79')).toBe('2.80');
    });

    test('rounds up from 80 to 90', () => {
        expect(getNextReleaseVersion('2.80')).toBe('2.90');
    });

    test('rounds up from 90 to 100', () => {
        expect(getNextReleaseVersion('2.90')).toBe('2.100');
    });

    test('works with different major versions', () => {
        expect(getNextReleaseVersion('1.74')).toBe('1.80');
        expect(getNextReleaseVersion('3.55')).toBe('3.60');
        expect(getNextReleaseVersion('10.99')).toBe('10.100');
    });

    test('handles version at exactly tens boundary', () => {
        expect(getNextReleaseVersion('2.10')).toBe('2.20');
        expect(getNextReleaseVersion('2.20')).toBe('2.30');
        expect(getNextReleaseVersion('2.30')).toBe('2.40');
    });
});
