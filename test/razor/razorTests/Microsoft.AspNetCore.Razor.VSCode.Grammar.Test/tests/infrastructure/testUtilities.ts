/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from '@jest/globals';
import { createSnapshot } from './snapshotFactory.ts';
import { tokenize } from './tokenizedContentProvider.ts';

export async function assertMatchesSnapshot(content: string) {
    const tokenizedContent = await tokenize(content);
    const currentSnapshot = createSnapshot(tokenizedContent);
    expect(currentSnapshot).toMatchSnapshot();
}
