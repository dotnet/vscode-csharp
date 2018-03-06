/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const getNullChannel = () => ({
    clear: () => {},
    show: () => {},
    append: (value) => {},
    appendLine: (value) => {}
});

export default getNullChannel;
