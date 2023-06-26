/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NestedError } from '../nestedError';
import { IPackage } from "./IPackage";

export class PackageError extends NestedError {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(public message: string,
        public pkg: IPackage,
        public innerError: Error | undefined) {
        super(message, innerError);
    }
}
