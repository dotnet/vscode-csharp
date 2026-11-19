/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Observable } from 'rxjs';
import Disposable from '../../disposable';
import { isDeepStrictEqual } from 'util';
import { LanguageServerOptions, languageServerOptions } from '../options';

type RelevantOptionValues = Map<keyof LanguageServerOptions, unknown>;

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

        const changedRelevantOptions = changedKeys.changedLanguageServerOptions.filter(
            (key) => !isDeepStrictEqual(oldOptions.get(key), newOptions.get(key))
        );
        oldOptions = newOptions;

        if (changedRelevantOptions.length > 0) {
            optionChangeObserver.handleOptionChanges({
                changedLanguageServerOptions: changedRelevantOptions,
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
    changedLanguageServerOptions: ReadonlyArray<keyof LanguageServerOptions>;
}

function getLatestRelevantOptions(changedKeys: OptionChanges): RelevantOptionValues {
    return new Map(changedKeys.changedLanguageServerOptions.map((key) => [key, languageServerOptions[key]]));
}
