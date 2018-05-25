/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class OmniSharpDownloadSettings {

    public defaultOmniSharpVersion: string;
    get omniSharpPath() {
        return this.getOmniSharpPath();
    }

    constructor(private getOmniSharpPath: () => string,
        public downloadServerUrl: string,
        public latestVersionFileServerPath: string,
        public installPath: string,
        public extensionPath: string,
        public packageJSON: any) {
        this.defaultOmniSharpVersion = packageJSON.defaults.omniSharp;
    }
}