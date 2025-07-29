/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { JestEnvironmentConfig, EnvironmentContext } from '@jest/environment';
import { TestEnvironment } from 'jest-environment-node';

/**
 * Defines a custom jest environment that allows us to replace vscode module imports with the
 * instance from the vscode extension in the test runner.
 */
class VsCodeEnvironment extends TestEnvironment {
    constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
        super(config, context);
    }

    public async setup() {
        await super.setup();
        this.global.vscode = vscode;
    }

    public async teardown() {
        this.global.vscode = {};
        return await super.teardown();
    }
}

module.exports = VsCodeEnvironment;
