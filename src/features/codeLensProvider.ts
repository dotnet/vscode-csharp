/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';
import { toLocation } from '../omnisharp/typeConversion';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { Options } from '../shared/options';
import TestManager from './dotnetTest';
import OptionProvider from '../shared/observers/optionProvider';

import Structure = protocol.V2.Structure;
import SymbolKinds = protocol.V2.SymbolKinds;
import SymbolPropertyNames = protocol.V2.SymbolPropertyNames;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;
import { LanguageMiddlewareFeature } from '../omnisharp/languageMiddlewareFeature';

abstract class OmniSharpCodeLens extends vscode.CodeLens {
    constructor(
        range: protocol.V2.Range,
        public fileName: string) {

        super(new vscode.Range(
            range.Start.Line, range.Start.Column, range.End.Line, range.End.Column
        ));
    }
}

class ReferencesCodeLens extends OmniSharpCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string) {
        super(range, fileName);
    }
}

abstract class TestCodeLens extends OmniSharpCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string,
        public displayName: string,
        public isTestContainer: boolean,
        public testFramework: string,
        public testMethodNames: string[]) {

        super(range, fileName);
    }
}

class RunTestsCodeLens extends TestCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string,
        displayName: string,
        isTestContainer: boolean,
        testFramework: string,
        testMethodNames: string[]) {

        super(range, fileName, displayName, isTestContainer, testFramework, testMethodNames);
    }
}

class DebugTestsCodeLens extends TestCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string,
        displayName: string,
        isTestContainer: boolean,
        testFramework: string,
        testMethodNames: string[]) {

        super(range, fileName, displayName, isTestContainer, testFramework, testMethodNames);
    }
}

interface Test {
    framework: string;
    methodName: string;
}

export default class OmniSharpCodeLensProvider extends AbstractProvider implements vscode.CodeLensProvider {

    constructor(server: OmniSharpServer, testManager: TestManager, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        const options = this.optionProvider.GetLatestOptions();
        if (!options.omnisharpOptions.showReferencesCodeLens && !options.omnisharpOptions.showTestsCodeLens) {
            return [];
        }

        try {
            const response = await serverUtils.codeStructure(this._server, { FileName: document.fileName }, token);
            if (response && response.Elements) {
                return createCodeLenses(response.Elements, document.fileName, options);
            }
        }
        catch (error) { /* empty */ }

        return [];
    }

    async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens | undefined> {
        if (codeLens instanceof ReferencesCodeLens) {
            return this.resolveReferencesCodeLens(codeLens, token);
        }
        else if (codeLens instanceof RunTestsCodeLens) {
            return this.resolveTestCodeLens(codeLens, 'Run Test', 'dotnet.test.run', 'Run All Tests', 'dotnet.classTests.run');
        }
        else if (codeLens instanceof DebugTestsCodeLens) {
            return this.resolveTestCodeLens(codeLens, 'Debug Test', 'dotnet.test.debug', 'Debug All Tests', 'dotnet.classTests.debug');
        }

        return undefined;
    }

    private async resolveReferencesCodeLens(codeLens: ReferencesCodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens | undefined> {
        const request: protocol.FindUsagesRequest = {
            FileName: codeLens.fileName,
            Line: codeLens.range.start.line,
            Column: codeLens.range.start.character,
            OnlyThisFile: false,
            ExcludeDefinition: true
        };

        try {
            const result = await serverUtils.findUsages(this._server, request, token);
            if (!result || !result.QuickFixes) {
                return undefined;
            }

            const quickFixes = result.QuickFixes;
            const count = quickFixes.length;
            const locations = quickFixes.map(toLocation);

            // Allow language middlewares to re-map its edits if necessary.
            const remappedLocations = await this._languageMiddlewareFeature.remap("remapLocations", locations, token);

            codeLens.command = {
                title: count === 1 ? '1 reference' : `${count} references`,
                command: 'editor.action.showReferences',
                arguments: [vscode.Uri.file(codeLens.fileName), codeLens.range.start, remappedLocations]
            };

            return codeLens;
        }
        catch (error) {
            return undefined;
        }
    }

    private async resolveTestCodeLens(codeLens: TestCodeLens, singularTitle: string, singularCommandName: string, pluralTitle: string, pluralCommandName: string): Promise<vscode.CodeLens | undefined> {
        if (!codeLens.isTestContainer) {
            // This is just a single test method, not a container.
            codeLens.command = {
                title: singularTitle,
                command: singularCommandName,
                arguments: [codeLens.testMethodNames[0], codeLens.fileName, codeLens.testFramework]
            };

            return codeLens;
        }

        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: codeLens.fileName });
        }
        catch (error) {
            return undefined;
        }

        if (projectInfo.MsBuildProject) {
            codeLens.command = {
                title: pluralTitle,
                command: pluralCommandName,
                arguments: [codeLens.displayName, codeLens.testMethodNames, codeLens.fileName, codeLens.testFramework]
            };
        }

        return codeLens;
    }
}

function createCodeLenses(elements: Structure.CodeElement[], fileName: string, options: Options): vscode.CodeLens[] {
    const results: vscode.CodeLens[] = [];

    Structure.walkCodeElements(elements, element => {
        const codeLenses = createCodeLensesForElement(element, fileName, options);

        results.push(...codeLenses);
    });

    return results;
}

function createCodeLensesForElement(element: Structure.CodeElement, fileName: string, options: Options): vscode.CodeLens[] {
    const results: vscode.CodeLens[] = [];

    if (options.omnisharpOptions.showReferencesCodeLens && isValidElementForReferencesCodeLens(element, options)) {
        const range = element.Ranges[SymbolRangeNames.Name];
        if (range) {
            results.push(new ReferencesCodeLens(range, fileName));
        }
    }

    if (options.omnisharpOptions.showTestsCodeLens) {
        if (element.Kind === SymbolKinds.Method) {
            const test = getTest(element);
            if (test !== undefined) {
                const range = element.Ranges[SymbolRangeNames.Name];
                if (range !== undefined) {
                    results.push(new RunTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ false, test.framework, [test.methodName]));
                    results.push(new DebugTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ false, test.framework, [test.methodName]));
                }
            }
        } else if (element.Kind === SymbolKinds.Class && element.Children !== undefined) {
            const methods = element.Children.filter(child => child.Kind === SymbolKinds.Method);

            const tests = methods
                .map(method => getTest(method))
                .filter((test): test is NonNullable<typeof test> => test !== undefined);

            // Note: We don't handle multiple test frameworks in the same class. The first test framework wins.
            const testFramework = tests.length > 0 ? tests[0].framework : undefined;
            if (testFramework !== undefined) {
                const testMethodNames = tests
                    .filter(test => test.framework === testFramework)
                    .map(test => test.methodName);

                const range = element.Ranges[SymbolRangeNames.Name];
                results.push(new RunTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ true, testFramework, testMethodNames));
                results.push(new DebugTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ true, testFramework, testMethodNames));
            }
        }
    }

    return results;
}

const filteredSymbolNames: { [name: string]: boolean } = {
    'Equals': true,
    'Finalize': true,
    'GetHashCode': true,
    'ToString': true,
    'Dispose': true,
    'GetEnumerator': true,
};

function isValidElementForReferencesCodeLens(element: Structure.CodeElement, options: Options): boolean {
    if (element.Kind === SymbolKinds.Namespace) {
        return false;
    }

    if (element.Kind === SymbolKinds.Method && filteredSymbolNames[element.Name]) {
        return false;
    }

    if(options.omnisharpOptions.filteredSymbolsCodeLens.includes(element.Name)) {
        return false;
    }

    return true;
}

function getTest(element: Structure.CodeElement): Test | undefined {
    if (element.Properties === undefined) {
        return undefined;
    }

    const framework = element.Properties[SymbolPropertyNames.TestFramework];
    const methodName = element.Properties[SymbolPropertyNames.TestMethodName];
    if (framework === undefined || methodName === undefined) {
        return undefined;
    }

    return {
        framework,
        methodName,
    };
}
