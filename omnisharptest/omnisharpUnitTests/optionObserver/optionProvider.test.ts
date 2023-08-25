/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getVSCodeWithConfig, updateConfig } from '../../../test/unitTests/fakes';
import { vscode } from '../../../src/vscodeAdapter';
import OptionProvider from '../../../src/shared/observers/optionProvider';
import { Subject } from 'rxjs';
import { Options } from '../../../src/shared/options';

suite('OptionProvider', () => {
    suiteSetup(() => should());

    let vscode: vscode;
    let optionProvider: OptionProvider;
    let optionObservable: Subject<Options>;

    setup(() => {
        vscode = getVSCodeWithConfig();
        optionObservable = new Subject<Options>();
        optionProvider = new OptionProvider(optionObservable);
    });

    test('Throws exception when no options are pushed', () => {
        expect(optionProvider.GetLatestOptions).to.throw();
    });

    test('Gives the latest options when options are changed', () => {
        const changingConfig = 'omnisharp';
        updateConfig(vscode, changingConfig, 'path', 'somePath');
        optionObservable.next(Options.Read(vscode));
        updateConfig(vscode, changingConfig, 'path', 'anotherPath');
        optionObservable.next(Options.Read(vscode));
        const options = optionProvider.GetLatestOptions();
        expect(options.commonOptions.serverPath).to.be.equal('anotherPath');
    });
});
