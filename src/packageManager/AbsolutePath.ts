/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isAbsolute, resolve } from "path";

export class AbsolutePath {
    constructor(public value: string) {
        if (!isAbsolute(value)) {
            throw new Error("The path must be absolute");
        }
    }

    public static getAbsolutePath(...pathSegments: string[]): AbsolutePath {
        return new AbsolutePath(resolve(...pathSegments));
    }
}