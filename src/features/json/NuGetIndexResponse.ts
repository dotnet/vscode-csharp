/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Sample Request: https://api.nuget.org/v3/index.json
export default interface NuGetIndexResponse {
    resources: NuGetResource[];
}

interface NuGetResource {
    '@type': string;
    '@id': string;
}