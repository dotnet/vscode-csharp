/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from './protocol';

const priorityCommands = [
    protocol.Requests.ChangeBuffer,
    protocol.Requests.FormatAfterKeystroke,
    protocol.Requests.FormatRange,
    protocol.Requests.UpdateBuffer
];

const normalCommands = [
    protocol.Requests.Completion,
    protocol.Requests.CompletionResolve,
    protocol.Requests.FilesChanged,
    protocol.Requests.FindSymbols,
    protocol.Requests.FindUsages,
    protocol.Requests.GetCodeActions,
    protocol.Requests.GoToDefinition,
    protocol.Requests.RunCodeAction,
    protocol.Requests.SignatureHelp,
    protocol.Requests.TypeLookup
];

const prioritySet = new Set<string>(priorityCommands);
const normalSet = new Set<string>(normalCommands);
const deferredSet = new Set<string>();

const nonDeferredSet = new Set<string>();

for (let command of priorityCommands) {
    nonDeferredSet.add(command);
}

for (let command of normalCommands) {
    nonDeferredSet.add(command);
}

export function isPriorityCommand(command: string) {
    return prioritySet.has(command);
}

export function isNormalCommand(command: string) {
    return normalSet.has(command);
}

export function isDeferredCommand(command: string) {
    if (deferredSet.has(command)) {
        return true;
    }

    if (nonDeferredSet.has(command)) {
        return false;
    }

    deferredSet.add(command);
    return true;
}