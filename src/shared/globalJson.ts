/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { commonOptions } from './options';

export function getValidatedDefaultGlobalJsonPath(reportDiagnostic: (message: string) => void): string | undefined {
    const defaultGlobalJson = commonOptions.defaultGlobalJson;
    if (defaultGlobalJson.length === 0) {
        return undefined;
    }

    if (path.basename(defaultGlobalJson).toLowerCase() !== 'global.json') {
        reportDiagnostic(
            `dotnet.defaultGlobalJson is set to '${defaultGlobalJson}', but the setting must point to a file named global.json.`
        );
        return undefined;
    }

    let stats: fs.Stats;
    try {
        stats = fs.statSync(defaultGlobalJson);
    } catch (_error) {
        reportDiagnostic(
            `dotnet.defaultGlobalJson is set to '${defaultGlobalJson}', but that path does not exist or cannot be accessed.`
        );
        return undefined;
    }

    if (!stats.isFile()) {
        reportDiagnostic(`dotnet.defaultGlobalJson is set to '${defaultGlobalJson}', but that path is not a file.`);
        return undefined;
    }

    return defaultGlobalJson;
}
