/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';

// Contains any unit-testable parts of SetNextStatement
export class SetNextStatementHelpers
{
    public static makeLabelsUnique(targets: DebugProtocol.GotoTarget[]) : { [key: string]: DebugProtocol.GotoTarget } {

        // first try: use the original label names
        let labelDict : { [key: string]: DebugProtocol.GotoTarget } | undefined = SetNextStatementHelpers.makeLabelDictorary(targets);
        if (!labelDict) {
            // next try to add on the source position
            labelDict = SetNextStatementHelpers.tryMakeLabelsUnique(targets, (target: DebugProtocol.GotoTarget) => `${target.label} : source position (${target.line},${target.column})-(${target.endLine},${target.endColumn})`);
            if (!labelDict) {
                // nothing worked, so just add on the array index as a prefix
                labelDict = SetNextStatementHelpers.tryMakeLabelsUnique(targets, (target: DebugProtocol.GotoTarget, index: number) => `${index+1}: ${target.label}`);
            }
        }

        return labelDict;
    }

    static tryMakeLabelsUnique(targets: DebugProtocol.GotoTarget[], getLabel: (target: DebugProtocol.GotoTarget, index?:number) => string) : { [key: string]: DebugProtocol.GotoTarget } | undefined {
        const labelDict = SetNextStatementHelpers.makeLabelDictorary(targets, getLabel);
        if (!labelDict) {
            // The specified 'getLabel' function wasn't able to make the label names unique
            return undefined;
        }

        // The specified 'getLabel' fenction worked. Update the 'label' names in the 'targets' array.
        targets.forEach((target, index) => {
            target.label = getLabel(target, index);
        });
        return labelDict;
    }

    static makeLabelDictorary(targets: DebugProtocol.GotoTarget[], getLabel?: (target: DebugProtocol.GotoTarget, index?:number) => string) : { [key: string]: DebugProtocol.GotoTarget } | undefined {
        if (!getLabel) {
            getLabel = (target) => target.label;
        }
        
        const labelNameDict : { [key: string]: DebugProtocol.GotoTarget } = {};
        let index:number = 0;
        for (const target of targets) {
            const key:string = getLabel(target, index);
            let existingItem = labelNameDict[key];
            if (existingItem !== undefined) {
                // multiple values with the same label found
                return undefined;
            }
            labelNameDict[key] = target;
            index++;
        }

        return labelNameDict;
    }
}