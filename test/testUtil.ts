/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function isNotNull<T>(value: T) : asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
        throw new Error("value is null or undefined.");
    }
}