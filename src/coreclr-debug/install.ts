/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CoreClrDebugUtil } from './util';
import * as fs from 'fs';
import * as path from 'path';

export class InstallError extends Error {
    public installStage: string;

    private _errorMessage: string;
    private _hasMoreErrors: boolean;

    public get hasMoreErrors(): boolean {
        return this._hasMoreErrors;
    }

    public get errorMessage(): string {
        return this._errorMessage;
    }

    public set errorMessage(message: string) {
        if (this._errorMessage !== null) {
            // Take note that we're overwriting a previous error.
            this._hasMoreErrors = true;
        }
        this._errorMessage = message;
    }

    constructor() {
        super('Error during installation.');
        this._errorMessage = null;
        this._hasMoreErrors = false;
    }

    public setHasMoreErrors(): void {
        this._hasMoreErrors = true;
    }
}

export class DebugInstaller {
    private _util: CoreClrDebugUtil = null;

    constructor(util: CoreClrDebugUtil) {
        this._util = util;
    }

    public finishInstall(): Promise<void> {
        let errorBuilder = new InstallError();

        return Promise.resolve().then(() => {
            errorBuilder.installStage = 'rewriteManifest';
            this.rewriteManifest();
            errorBuilder.installStage = 'writeCompletionFile'
            return CoreClrDebugUtil.writeEmptyFile(this._util.installCompleteFilePath());
         }).catch((err) => {
            if (errorBuilder.errorMessage === null) {
                // Only give the error message if we don't have any better info,
                // as this is usually something similar to "Error: 1".
                errorBuilder.errorMessage = err;
            }

            throw errorBuilder;
        });
    }

    private rewriteManifest(): void {
        const manifestPath = path.join(this._util.extensionDir(), 'package.json');
        let manifestString = fs.readFileSync(manifestPath, 'utf8');
        let manifestObject = JSON.parse(manifestString);
        delete manifestObject.contributes.debuggers[0].runtime;
        delete manifestObject.contributes.debuggers[0].program;

        let programString = './.debugger/OpenDebugAD7';
        manifestObject.contributes.debuggers[0].windows = { program: programString + '.exe' };
        manifestObject.contributes.debuggers[0].osx = { program: programString };
        manifestObject.contributes.debuggers[0].linux = { program: programString };

        manifestString = JSON.stringify(manifestObject, null, 2);
        fs.writeFileSync(manifestPath, manifestString);
    }
}