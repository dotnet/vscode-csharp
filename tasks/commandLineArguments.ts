/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as minimist from 'minimist';
import * as path from 'path';

const argv = minimist(process.argv.slice(2));

export const commandLineOptions = {
    outputFolder: makePathAbsolute(argv['o']),
    codeExtensionPath: makePathAbsolute(argv['codeExtensionPath']),
};

function makePathAbsolute(originalPath: string) {
    if (!originalPath || originalPath == '') {
        return undefined;
    }

    return path.resolve(originalPath);
}
