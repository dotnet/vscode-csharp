/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { parseArgs } from 'util';
import { rootPath } from '../projectPaths';

export function parseCodeExtensionPath(args: string[] = process.argv.slice(2)): string {
    const { values } = parseArgs({
        args,
        options: {
            codeExtensionPath: { type: 'string' },
        },
        strict: true,
    });

    return path.resolve(values.codeExtensionPath ?? rootPath);
}
