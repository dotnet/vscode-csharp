/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved. 
 *  Licensed under the MIT License. See License.txt in the project root for license information. 
 *--------------------------------------------------------------------------------------------*/

export default class Disposable {
    private onDispose: { (): void };

    constructor(onDispose: { (): void }) {
        if (!onDispose) {
            throw new Error("onDispose cannot be null or empty.");
        }

        this.onDispose = onDispose;
    }

    public dispose = (): void => {
        this.onDispose();
    }
}
