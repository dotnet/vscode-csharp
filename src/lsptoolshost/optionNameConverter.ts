/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('node:assert');

export function convertServerOptionNameToClientConfigurationName(section: string): string | null {
    // Server name would be in format {languageName}|{grouping}.{name} or
    // {grouping}.{name} if this option can be applied to multiple languages.
    const languageNameIndex = section.indexOf('|');
    if (languageNameIndex == -1 || section.substring(0, languageNameIndex) == 'csharp') {
        // 1. locate the last dot to find the {name} part.
        const lastDotIndex = section.lastIndexOf('.');
        assert(lastDotIndex !== -1, `There is no . in ${section}.`);
        const optionName = section.substring(lastDotIndex + 1);

        // 2. Get {grouping} part.
        const startIndex = languageNameIndex == -1 ? 0 : languageNameIndex + 1;
        const optionGroupName = section.substring(startIndex, lastDotIndex);

        // 3. {name} part from roslyn would be in editorconfig-like form.
        // A valid prefix here is dotnet, csharp or no prefix
        // We need to find the dotnet or csharp prefix, and use it in before the grouping.
        // Example:
        // Grouping: implement_type
        // Name: dotnet_insertion_behavior
        // Expect result is: dotnet.implmentType.insertionBehavior
        const prefixes = ['dotnet', 'csharp'];
        const optionNamePrefix = getPrefix(optionName, prefixes);

        const featureName = optionNamePrefix == '' ? optionName : optionName.substring(optionNamePrefix.length + 1);

        // Finally, convert everything to camel case and put them together.
        const camelCaseGroupName = convertToCamelCase(optionGroupName, '_');
        const camelCaseFeatureName = convertToCamelCase(featureName, '_');
        return optionNamePrefix == ''
            ? camelCaseGroupName.concat('.', camelCaseFeatureName)
            : convertToCamelCase(optionNamePrefix, '_').concat('.', camelCaseGroupName, '.', camelCaseFeatureName);
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
    const words = inputString.split(delimiter).map((word) => word.toLowerCase());
    if (words.length <= 1) {
        return inputString.toLowerCase();
    }

    const firstWord = words[0];
    const capitalizedWords = words.slice(1).map(capitalize);
    return firstWord.concat(...capitalizedWords);
}

function capitalize(inputString: string): string {
    return inputString.charAt(0).toUpperCase() + inputString.substring(1);
}
