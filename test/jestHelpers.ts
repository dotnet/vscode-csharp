/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { EOL, platform } from 'os';
import { describe, expect, test } from '@jest/globals';
import { usingDevKit } from './lsptoolshost/integrationTests/integrationHelpers';

export async function expectText(document: vscode.TextDocument, expectedLines: string[]) {
    const expectedText = expectedLines.join(EOL);
    expect(document.getText()).toBe(expectedText);
}

export function expectPath(expected: vscode.Uri, actual: vscode.Uri) {
    if (isLinux()) {
        expect(actual.path).toBe(expected.path);
    } else {
        const actualPath = actual.path.toLowerCase();
        const expectedPath = expected.path.toLocaleLowerCase();
        expect(actualPath).toBe(expectedPath);
    }
}

export const describeIfCSharp = describeIf(!usingDevKit());
export const describeIfDevKit = describeIf(usingDevKit());
export const describeIfNotMacOS = describeIf(!isMacOS());
export const describeIfWindows = describeIf(isWindows());
export const testIfCSharp = testIf(!usingDevKit());
export const testIfDevKit = testIf(usingDevKit());
export const testIfNotMacOS = testIf(!isMacOS());
export const testIfWindows = testIf(isWindows());

function describeIf(condition: boolean) {
    return condition ? describe : describe.skip;
}

function testIf(condition: boolean) {
    return condition ? test : test.skip;
}

function isMacOS() {
    const currentPlatform = platform();
    return currentPlatform === 'darwin';
}

function isWindows() {
    const currentPlatform = platform();
    return currentPlatform === 'win32';
}

function isLinux() {
    return !(isMacOS() || isWindows());
}
