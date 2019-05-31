/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';

export enum StatusBarColors{
    Red = 'rgb(218,0,0)',
    Green = 'rgb(0,218,0)',
    Yellow = 'rgb(218,218,0)'
}

export class BackgroundWorkObserver extends BaseStatusBarItemObserver {
    public post = () => {
        this.SetAndShowStatusBar('$(sync~spin) Analyzing project.foo.csproj', 'o.showOutput', null, 'Analyzing project.foo.csproj...');
    }
}

