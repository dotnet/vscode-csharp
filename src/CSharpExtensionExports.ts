/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Advisor } from "./features/diagnosticsProvider";

 export default interface CSharpExtensionExports {
    initializationFinished: () => Promise<void>;

    getAdvisor: () => Promise<Advisor>;
 }