/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { getUpdatedCopilotLspConfigContent } from '../../../src/lsptoolshost/copilotLspConfig';

describe('Copilot LSP config installation', () => {
    test('is idempotent and preserves shipped config content across multiple runs', () => {
        const packagedContent = readFileSync('copilot/lsp-config.json', 'utf8');

        const firstRun = getUpdatedCopilotLspConfigContent(undefined, packagedContent);
        expect(firstRun.shouldWrite).toBe(true);
        expect(firstRun.updatedContent).toBe(packagedContent);

        const secondRun = getUpdatedCopilotLspConfigContent(firstRun.updatedContent, packagedContent);
        expect(secondRun.shouldWrite).toBe(false);

        const finalContent = secondRun.updatedContent ?? firstRun.updatedContent;
        expect(finalContent).toBe(packagedContent);
    });
});
