/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {assert, expect} from 'chai';
import {convertServerOptionNameToClientConfigurationName} from '../../../src/lsptoolshost/OptionNameConverter';
import { readFileSync } from 'fs';

const testData = [
    { serverOption: "csharp|symbol_search.dotnet_search_reference_assemblies", vsCodeConfiguration: "dotnet.symbolSearch.searchReferenceAssemblies", declareInPackageJson: true},
    { serverOption: "mystery_language|symbol_search.dotnet_search_reference_assemblies", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "csharp|implement_type.dotnet_insertion_behavior", vsCodeConfiguration: "dotnet.implementType.insertionBehavior", declareInPackageJson: true},
    { serverOption: "mystery_language|implement_type.dotnet_insertion_behavior", vsCodeConfiguration: null, declareInPackageJson: false },
    { serverOption: "csharp|implement_type.dotnet_property_generation_behavior", vsCodeConfiguration: "dotnet.implementType.propertyGenerationBehavior", declareInPackageJson: true},
    { serverOption: "mystery_language|implement_type.dotnet_property_generation_behavior", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "csharp|completion.dotnet_show_name_completion_suggestions", vsCodeConfiguration: "dotnet.completion.showNameCompletionSuggestions", declareInPackageJson: true},
    { serverOption: "mystery_language|completion.dotnet_show_name_completion_suggestions", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "csharp|completion.dotnet_provide_regex_completions", vsCodeConfiguration: "dotnet.completion.provideRegexCompletions", declareInPackageJson: true},
    { serverOption: "mystery_language|completion.dotnet_provide_regex_completions", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "csharp|quick_info.dotnet_show_remarks_in_quick_info", vsCodeConfiguration: "dotnet.quickInfo.showRemarksInQuickInfo", declareInPackageJson: true},
    { serverOption: "mystery_language|quick_info.dotnet_show_remarks_in_quick_info", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "navigation.dotnet_navigate_to_decompiled_sources", vsCodeConfiguration: "dotnet.navigation.navigateToDecompiledSources", declareInPackageJson: true},
    { serverOption: "csharp|highlighting.dotnet_highlight_related_regex_components", vsCodeConfiguration: "dotnet.highlighting.highlightRelatedRegexComponents", declareInPackageJson: true},
    { serverOption: "mystery_language|highlighting.dotnet_highlight_related_regex_components", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "csharp|highlighting.dotnet_highlight_related_json_components", vsCodeConfiguration: "dotnet.highlighting.highlightRelatedJsonComponents", declareInPackageJson: true},
    { serverOption: "mystery_language|Highlighting.dotnet_highlight_related_json_components", vsCodeConfiguration: null, declareInPackageJson: false},
    { serverOption: "text_editor.tab_width", vsCodeConfiguration: "textEditor.tabWidth", declareInPackageJson: false}
]

suite("Server option name to vscode configuration name test", () => {
    let packageJson = JSON.parse(readFileSync('package.json').toString());
    let configurations = Object.keys(packageJson["contributes"]["configuration"]["properties"]);

    testData.forEach((data) => {
        let actualName = convertServerOptionNameToClientConfigurationName(data.serverOption);
        expect(actualName).to.equal(data.vsCodeConfiguration);
        if (data.declareInPackageJson) {
            assert.include(configurations, data.vsCodeConfiguration);
        }
    })
});