/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isAbsolute, resolve } from "path";

export class AbsolutePath{
    constructor(public path: string) {
        if (!isAbsolute(path)) {
            throw new Error("The path must be absolute");
        }
    }

    public static getAbsolutePath(pathToPrepend: string, path: string): AbsolutePath {
        return new AbsolutePath(resolve(pathToPrepend, path));
    }
}