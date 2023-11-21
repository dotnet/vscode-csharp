/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class MonitorConfigurationFilePathParams {
    constructor(public readonly ProjectKeyId: string, public readonly ConfigurationFilePath: string | undefined) {}
}
