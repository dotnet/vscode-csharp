/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface TestFile {
    content: string;
    path: string;
}

export function createTestFile(content: string, path: string): TestFile {
    return {
        content,
        path
    };
}
