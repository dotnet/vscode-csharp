/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbsolutePath } from "./AbsolutePath";
import * as fs from "fs";
import * as util from "util";
import objectHash = require("object-hash");

const readDirAsync = util.promisify(fs.readdir);

export async function isValidInstallation(installPath: AbsolutePath, sha: string): Promise<boolean> {
    //if (sha && sha.length > 0){
        let files = await readDirAsync(installPath.value);
        let uniqueSha = objectHash(files);
        if (uniqueSha == sha) {
            return true;
        }
        
        return false;
    //}


    //If there is no sha for the package, return true
    //return true;
}