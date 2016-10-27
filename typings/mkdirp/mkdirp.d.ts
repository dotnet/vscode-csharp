/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module "mkdirp" {
    export function mkdirp(
        dir: string, 
        opts: {
            mode?: number
        },
        cb: (err: any)=>void): void;
}