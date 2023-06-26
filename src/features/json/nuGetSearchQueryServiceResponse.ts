/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Sample Request: https://api-v2v3search-0.nuget.org/query?q=newtonsoft.json&take=5

export default interface NuGetSearchQueryServiceResponse {
    data: NuGetSearchQueryServiceDataElement[];
}

interface NuGetSearchQueryServiceDataElement {
    id: string;
    description: string;
    version: string;
}