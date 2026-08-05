/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { parseArgs } from 'util';

const { values: argv } = parseArgs({
    options: {
        o: { type: 'string', short: 'o' },
        codeExtensionPath: { type: 'string' },
    },
    strict: false,
});

export const commandLineOptions = {
    outputFolder: makePathAbsolute(argv['o']),
    codeExtensionPath: makePathAbsolute(argv['codeExtensionPath']),
};

function makePathAbsolute(originalPath: string | boolean | undefined) {
    if (typeof originalPath !== 'string' || originalPath == '') {
        return undefined;
    }

    return path.resolve(originalPath);
}
