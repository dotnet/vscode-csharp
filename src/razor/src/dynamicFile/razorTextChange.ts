/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { razorTextSpan } from './razorTextSpan';

export class razorTextChange {
    constructor(public readonly newText: string | null, public readonly span: razorTextSpan) {}
}
