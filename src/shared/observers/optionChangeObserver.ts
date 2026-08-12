/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Observable } from 'rxjs';
import Disposable from '../../disposable';
import { isDeepStrictEqual } from 'util';
import { CommonOptions, LanguageServerOptions, commonOptions, languageServerOptions } from '../options';

type RelevantOptionValues = {
    commonOptions: Map<keyof CommonOptions, any>;
    languageServerOptions: Map<keyof LanguageServerOptions, any>;
};

export function HandleOptionChanges(
    optionObservable: Observable<void>,
    optionChangeObserver: OptionChangeObserver
): Disposable {
    let oldOptions: RelevantOptionValues;
    const subscription = optionObservable.pipe().subscribe(() => {
        const changedKeys = optionChangeObserver.getRelevantOptions();
        const newOptions = getLatestRelevantOptions(changedKeys);
        if (!oldOptions) {
            oldOptions = newOptions;
        }

        const changedRelevantCommonOptions = changedKeys.changedCommonOptions.filter(
            (key) => !isDeepStrictEqual(oldOptions.commonOptions.get(key), newOptions.commonOptions.get(key))
        );
        const changedRelevantLanguageServerOptions = changedKeys.changedLanguageServerOptions.filter(
            (key) =>
                !isDeepStrictEqual(oldOptions.languageServerOptions.get(key), newOptions.languageServerOptions.get(key))
        );
        oldOptions = newOptions;

        if (changedRelevantCommonOptions.length > 0 || changedRelevantLanguageServerOptions.length > 0) {
            optionChangeObserver.handleOptionChanges({
                changedCommonOptions: changedRelevantCommonOptions,
                changedLanguageServerOptions: changedRelevantLanguageServerOptions,
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
}

function getLatestRelevantOptions(changedKeys: OptionChanges): RelevantOptionValues {
    return {
        commonOptions: new Map(changedKeys.changedCommonOptions.map((key) => [key, commonOptions[key]])),
        languageServerOptions: new Map(
            changedKeys.changedLanguageServerOptions.map((key) => [key, languageServerOptions[key]])
        ),
    };
}
