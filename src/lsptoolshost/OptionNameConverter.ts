/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('node:assert');

// Inline hints is called inlay hints in vscode.
const wellKnownClientNameMapping: Map<string, string> = new Map([["inline_hints", "inlay_hints"]]);

export function convertServerOptionNameToClientConfigurationName(section: string) : string | null {
    // Server name would be in format {languageName}|{grouping}.{name} or
    // {grouping}.{name} if this option can be applied to multiple languages.
    let languageNameIndex = section.indexOf('|');
    if (languageNameIndex == -1 || section.substring(0, languageNameIndex) == 'csharp') {
        // 1. locate the last dot to find the {name} part.
        let lastDotIndex = section.lastIndexOf('.');
        assert(lastDotIndex !== -1, `There is no . in ${section}.`);
        let optionName = section.substring(lastDotIndex + 1);

        // 2. Get {grouping} part.
        let startIndex = languageNameIndex == -1 ? 0 : languageNameIndex + 1;
        let featureGroupName = section.substring(startIndex, lastDotIndex);

        // 3. {name} part from roslyn would be in editorconfig-like form.
        // A valid prefix here is dotnet, csharp or no prefix
        // We need to find the dotnet or csharp prefix, and use it in before the grouping.
        // Example:
        // Grouping: implement_type
        // Name: dotnet_insertion_behavior
        // Expect result is: dotnet.implmentType.insertionBehavior
        const prefixes = ['dotnet', 'csharp'];
        let optionNamePrefix = getPrefix(optionName, prefixes);

        let featureName = optionNamePrefix == '' ? optionName: optionName.substring(optionNamePrefix.length + 1);

        // If the feature has a well-known name in the client, like inline hints -> inlay hints. Do the mapping.
        if (wellKnownClientNameMapping.has(featureGroupName)) {
            let clientSideName = wellKnownClientNameMapping.get(featureGroupName)!;
            featureName = featureName.replaceAll(featureGroupName, clientSideName);
            featureGroupName = clientSideName;
        }

        // Convert everything to camel case.
        let camelCaseFeatureGroupName = convertToCamelCase(featureGroupName, '_');
        let camelCaseFeatureName = convertToCamelCase(featureName, '_');

        // Put everything together.
        return optionNamePrefix == ''
            ? camelCaseFeatureGroupName.concat('.', camelCaseFeatureName)
            : convertToCamelCase(optionNamePrefix, '_').concat('.', camelCaseFeatureGroupName, '.', camelCaseFeatureName);
    }

    return null;
}

function getPrefix(section: string, prefixes: string[]) {
    let prefix = '';
    for (const possiblePrefix of prefixes) {
        if (section.startsWith(possiblePrefix)) {
            prefix = possiblePrefix;
            break;
        }
    }

    return prefix;
}

function convertToCamelCase(inputString: string, delimiter: string): string {
    let words = inputString.split(delimiter).map(word => word.toLowerCase());
    if (words.length <= 1) {
        return inputString.toLowerCase();
    }

    let firstWord = words[0];
    let capitalizedWords = words.slice(1).map(capitalize);
    return firstWord.concat(...capitalizedWords);
}

function capitalize(inputString: string): string {
   return inputString.charAt(0).toUpperCase() + inputString.substring(1);
}