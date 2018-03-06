/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const getNullChannel = () => ({
    clear: () => { },
    show: () => { },
    append: (value) => { },
    appendLine: (value) => { }
});

export const getNullLogger = () => ({
    append: (value?: string) => { },
    appendLine: (value?: string) => { },
    increaseIndent: () => { },
    decreaseIndent: () => { }
});
