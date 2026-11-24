/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { componentInfo, getComponentPaths } from '../../../src/lsptoolshost/extensions/builtInComponents';

jest.mock('fs');

describe('DevKit package completion component', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    it('shares the signed managed payload and existing directory override', () => {
        expect(componentInfo.packageCompletion.defaultFolderName).toBe(componentInfo.testDiscovery.defaultFolderName);
        expect(componentInfo.packageCompletion.optionName).toBe(componentInfo.testDiscovery.optionName);
        jest.mocked(fs.existsSync).mockReturnValue(true);
        expect(getComponentPaths('packageCompletion', undefined)[0]).toMatch(
            /Microsoft\.VisualStudio\.CSharpDevKit\.PackageCompletion\.dll$/
        );
    });

    it('does not disable discovery when an older payload lacks completion', () => {
        jest.mocked(fs.existsSync).mockImplementation((file) => file.toString().endsWith('SourceTestDiscovery.dll'));
        expect(getComponentPaths('packageCompletion', undefined)).toEqual([]);
        expect(getComponentPaths('testDiscovery', undefined)).toHaveLength(1);
    });
});
