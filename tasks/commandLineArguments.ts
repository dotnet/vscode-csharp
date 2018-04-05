/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as minimist from 'minimist';
import * as path from 'path';

let argv = minimist(process.argv.slice(2), { 
    boolean: ['retainVsix'], 
    string: ['o', 'codeExtensionPath'] });

export const commandLineOptions ={
    retainVsix: !!argv['retainVsix'],
    vsixPackagingOutputFolder:  makePathAbsolute(argv['o']),
    codeExtensionPath: makePathAbsolute(argv['codeExtensionPath'])
};

function makePathAbsolute(originalPath: string) {
    if (!originalPath) {
        return originalPath;
    }

    if (path.isAbsolute(originalPath)) {
        return originalPath;        
    }

    return path.resolve(originalPath);
}
