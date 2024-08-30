/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { convertServerOptionNameToClientConfigurationName } from '../../src/lsptoolshost/optionNameConverter';
import { describe, test, expect } from '@jest/globals';

const editorBehaviorSection = 1;
const testData = [
    {
        serverOption: 'csharp|symbol_search.dotnet_search_reference_assemblies',
        vsCodeConfiguration: 'dotnet.symbolSearch.searchReferenceAssemblies',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|symbol_search.dotnet_search_reference_assemblies',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|type_members.dotnet_member_insertion_location',
        vsCodeConfiguration: 'dotnet.typeMembers.memberInsertionLocation',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|type_members.dotnet_member_insertion_location ',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|type_members.dotnet_property_generation_behavior',
        vsCodeConfiguration: 'dotnet.typeMembers.propertyGenerationBehavior',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|type_members.dotnet_property_generation_behavior',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|completion.dotnet_show_name_completion_suggestions',
        vsCodeConfiguration: 'dotnet.completion.showNameCompletionSuggestions',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|completion.dotnet_show_name_completion_suggestions',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|completion.dotnet_provide_regex_completions',
        vsCodeConfiguration: 'dotnet.completion.provideRegexCompletions',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|completion.dotnet_provide_regex_completions',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|completion.dotnet_show_completion_items_from_unimported_namespaces',
        vsCodeConfiguration: 'dotnet.completion.showCompletionItemsFromUnimportedNamespaces',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|completion.dotnet_show_completion_items_from_unimported_namespaces',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|quick_info.dotnet_show_remarks_in_quick_info',
        vsCodeConfiguration: 'dotnet.quickInfo.showRemarksInQuickInfo',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|quick_info.dotnet_show_remarks_in_quick_info',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'navigation.dotnet_navigate_to_decompiled_sources',
        vsCodeConfiguration: 'dotnet.navigation.navigateToDecompiledSources',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|highlighting.dotnet_highlight_related_regex_components',
        vsCodeConfiguration: 'dotnet.highlighting.highlightRelatedRegexComponents',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|highlighting.dotnet_highlight_related_regex_components',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|highlighting.dotnet_highlight_related_json_components',
        vsCodeConfiguration: 'dotnet.highlighting.highlightRelatedJsonComponents',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|Highlighting.dotnet_highlight_related_json_components',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'text_editor.tab_width',
        vsCodeConfiguration: 'textEditor.tabWidth',
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_enable_inlay_hints_for_parameters',
        vsCodeConfiguration: 'dotnet.inlayHints.enableInlayHintsForParameters',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_enable_inlay_hints_for_literal_parameters',
        vsCodeConfiguration: 'dotnet.inlayHints.enableInlayHintsForLiteralParameters',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_enable_inlay_hints_for_indexer_parameters',
        vsCodeConfiguration: 'dotnet.inlayHints.enableInlayHintsForIndexerParameters',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_enable_inlay_hints_for_object_creation_parameters',
        vsCodeConfiguration: 'dotnet.inlayHints.enableInlayHintsForObjectCreationParameters',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_enable_inlay_hints_for_other_parameters',
        vsCodeConfiguration: 'dotnet.inlayHints.enableInlayHintsForOtherParameters',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_suppress_inlay_hints_for_parameters_that_differ_only_by_suffix',
        vsCodeConfiguration: 'dotnet.inlayHints.suppressInlayHintsForParametersThatDifferOnlyBySuffix',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_suppress_inlay_hints_for_parameters_that_match_method_intent',
        vsCodeConfiguration: 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchMethodIntent',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.dotnet_suppress_inlay_hints_for_parameters_that_match_argument_name',
        vsCodeConfiguration: 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchArgumentName',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.csharp_enable_inlay_hints_for_types',
        vsCodeConfiguration: 'csharp.inlayHints.enableInlayHintsForTypes',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.csharp_enable_inlay_hints_for_implicit_variable_types',
        vsCodeConfiguration: 'csharp.inlayHints.enableInlayHintsForImplicitVariableTypes',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.csharp_enable_inlay_hints_for_lambda_parameter_types',
        vsCodeConfiguration: 'csharp.inlayHints.enableInlayHintsForLambdaParameterTypes',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|inlay_hints.csharp_enable_inlay_hints_for_implicit_object_creation',
        vsCodeConfiguration: 'csharp.inlayHints.enableInlayHintsForImplicitObjectCreation',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|code_style.formatting.indentation_and_spacing.tab_width',
        vsCodeConfiguration: 'codeStyle.formatting.indentationAndSpacing.tabWidth',
        declareInPackageJson: false,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'csharp|code_style.formatting.indentation_and_spacing.indent_size',
        vsCodeConfiguration: 'codeStyle.formatting.indentationAndSpacing.indentSize',
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|code_style.formatting.indentation_and_spacing.indent_style',
        vsCodeConfiguration: 'codeStyle.formatting.indentationAndSpacing.indentStyle',
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|code_style.formatting.new_line.end_of_line',
        vsCodeConfiguration: 'codeStyle.formatting.newLine.endOfLine',
        declareInPackageJson: false,
    },
    {
        serverOption: 'code_style.formatting.new_line.insert_final_newline',
        vsCodeConfiguration: 'codeStyle.formatting.newLine.insertFinalNewline',
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|background_analysis.dotnet_analyzer_diagnostics_scope',
        vsCodeConfiguration: 'dotnet.backgroundAnalysis.analyzerDiagnosticsScope',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|background_analysis.dotnet_analyzer_diagnostics_scope',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|background_analysis.dotnet_compiler_diagnostics_scope',
        vsCodeConfiguration: 'dotnet.backgroundAnalysis.compilerDiagnosticsScope',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|background_analysis.dotnet_compiler_diagnostics_scope',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|code_lens.dotnet_enable_references_code_lens',
        vsCodeConfiguration: 'dotnet.codeLens.enableReferencesCodeLens',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|code_lens.dotnet_enable_references_code_lens',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
    {
        serverOption: 'csharp|code_lens.dotnet_enable_tests_code_lens',
        vsCodeConfiguration: 'dotnet.codeLens.enableTestsCodeLens',
        declareInPackageJson: true,
        section: editorBehaviorSection,
    },
    {
        serverOption: 'mystery_language|code_lens.dotnet_enable_tests_code_lens',
        vsCodeConfiguration: null,
        declareInPackageJson: false,
    },
];

describe('Server option name to vscode configuration name test', () => {
    const packageJson = JSON.parse(readFileSync('package.json').toString());
    const configurations = <any[]>packageJson['contributes']['configuration'];
    const numConfigurations = 5;
    test('Max server sections are expected', () => {
        expect(configurations.length).toBe(numConfigurations);
    });

    testData.forEach((data) => {
        test(`Server option name ${data.serverOption} should be converted to ${data.vsCodeConfiguration}`, () => {
            const actualName = convertServerOptionNameToClientConfigurationName(data.serverOption);
            expect(actualName).toBe(data.vsCodeConfiguration);
            if (data.declareInPackageJson) {
                const section = Object.keys(configurations[data.section!]['properties']);
                expect(section).toContain(data.vsCodeConfiguration);
            }
        });
    });
});
