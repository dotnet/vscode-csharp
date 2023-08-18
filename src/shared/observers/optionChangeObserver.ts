/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommonOptions, LanguageServerOptions, OmnisharpServerOptions, Options } from '../options';
import { Observable } from 'rxjs';
import Disposable from '../../disposable';
import { isDeepStrictEqual } from 'util';

export function HandleOptionChanges(
    optionObservable: Observable<Options>,
    optionChangeObserver: OptionChangeObserver
): Disposable {
    let oldOptions: Options;
    const subscription = optionObservable.pipe().subscribe((newOptions) => {
        if (!oldOptions) {
            oldOptions = newOptions;
            return;
        }
        const relevantOptions = optionChangeObserver.getRelevantOptions();
        const changedRelevantCommonOptions = relevantOptions.changedCommonOptions.filter(
            (key) => !isDeepStrictEqual(oldOptions.commonOptions[key], newOptions.commonOptions[key])
        );
        const changedRelevantLanguageServerOptions = relevantOptions.changedLanguageServerOptions.filter(
            (key) => !isDeepStrictEqual(oldOptions.languageServerOptions[key], newOptions.languageServerOptions[key])
        );
        const changedRelevantOmnisharpOptions = relevantOptions.changedOmnisharpOptions.filter(
            (key) => !isDeepStrictEqual(oldOptions.omnisharpOptions[key], newOptions.omnisharpOptions[key])
        );

        oldOptions = newOptions;

        if (
            changedRelevantCommonOptions.length > 0 ||
            changedRelevantLanguageServerOptions.length > 0 ||
            changedRelevantOmnisharpOptions.length > 0
        ) {
            optionChangeObserver.handleOptionChanges({
                changedCommonOptions: changedRelevantCommonOptions,
                changedLanguageServerOptions: changedRelevantLanguageServerOptions,
                changedOmnisharpOptions: changedRelevantOmnisharpOptions,
            });
        }
    });

    return new Disposable(subscription);
}

export interface OptionChangeObserver {
    getRelevantOptions: () => OptionChanges;
    handleOptionChanges: (optionChanges: OptionChanges) => void;
}

export interface OptionChanges {
    changedCommonOptions: ReadonlyArray<keyof CommonOptions>;
    changedLanguageServerOptions: ReadonlyArray<keyof LanguageServerOptions>;
    changedOmnisharpOptions: ReadonlyArray<keyof OmnisharpServerOptions>;
}
