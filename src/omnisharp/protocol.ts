/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

export module Requests {
    export const AddToProject = '/addtoproject';
    export const AutoComplete = '/autocomplete';
    export const CodeCheck = '/codecheck';
    export const CodeFormat = '/codeformat';
    export const ChangeBuffer = '/changebuffer';
    export const CurrentFileMembersAsTree = '/currentfilemembersastree';
    export const FileClose = '/close';
    export const FileOpen = '/open';
    export const FilesChanged = '/filesChanged';
    export const FindSymbols = '/findsymbols';
    export const FindUsages = '/findusages';
    export const FormatAfterKeystroke = '/formatAfterKeystroke';
    export const FormatRange = '/formatRange';
    export const GetCodeActions = '/getcodeactions';
    export const GoToDefinition = '/gotoDefinition';
    export const FindImplementations = '/findimplementations';
    export const Project = '/project';
    export const Projects = '/projects';
    export const RemoveFromProject = '/removefromproject';
    export const Rename = '/rename';
    export const RunCodeAction = '/runcodeaction';
    export const SignatureHelp = '/signatureHelp';
    export const TypeLookup = '/typelookup';
    export const UpdateBuffer = '/updatebuffer';
    export const Metadata = '/metadata';
}

export namespace WireProtocol {
    export interface Packet {
        Type: string;
        Seq: number;
    }

    export interface RequestPacket extends Packet {
        Command: string;
        Arguments: any;
    }

    export interface ResponsePacket extends Packet {
        Command: string;
        Request_seq: number;
        Running: boolean;
        Success: boolean;
        Message: string;
        Body: any;
    }

    export interface EventPacket extends Packet {
        Event: string;
        Body: any;
    }
}

export interface FileBasedRequest {
    FileName: string;
}

export interface Request extends FileBasedRequest {
    Line?: number;
    Column?: number;
    Buffer?: string;
    Changes?: LinePositionSpanTextChange[];
}

export interface GoToDefinitionRequest extends Request {
    WantMetadata?: boolean;
}

export interface FindImplementationsRequest extends Request {
}

export interface LinePositionSpanTextChange {
    NewText: string;
    StartLine: number;
    StartColumn: number;
    EndLine: number;
    EndColumn: number;
}

export interface MetadataSource {
    AssemblyName: string;
    ProjectName: string;
    VersionNumber: string;
    Language: string;
    TypeName: string;
}

export interface MetadataRequest extends MetadataSource {
    Timeout?: number;
}

export interface MetadataResponse {
    SourceName: string;
    Source: string;
}

export interface UpdateBufferRequest extends Request {
    FromDisk?: boolean;
}

export interface ChangeBufferRequest {
    FileName: string;
    StartLine: number;
    StartColumn: number;
    EndLine: number;
    EndColumn: number;
    NewText: string;
}

export interface AddToProjectRequest extends Request {
    //?
}

export interface RemoveFromProjectRequest extends Request {
    //?
}

export interface FindUsagesRequest extends Request {
    //        MaxWidth: number; ?
    OnlyThisFile: boolean;
    ExcludeDefinition: boolean;
}

export interface FindSymbolsRequest extends Request {
    Filter: string;
}

export interface FormatRequest extends Request {
    ExpandTab: boolean;
}

export interface CodeActionRequest extends Request {
    CodeAction: number;
    WantsTextChanges?: boolean;
    SelectionStartColumn?: number;
    SelectionStartLine?: number;
    SelectionEndColumn?: number;
    SelectionEndLine?: number;
}

export interface FormatResponse {
    Buffer: string;
}

export interface TextChange {
    NewText: string;
    StartLine: number;
    StartColumn: number;
    EndLine: number;
    EndColumn: number;
}

export interface FormatAfterKeystrokeRequest extends Request {
    Character: string;
}

export interface FormatRangeRequest extends Request {
    EndLine: number;
    EndColumn: number;
}

export interface FormatRangeResponse {
    Changes: TextChange[];
}

export interface ResourceLocation {
    FileName: string;
    Line: number;
    Column: number;
}

export interface GoToDefinitionResponse extends ResourceLocation {
    MetadataSource?: MetadataSource;
}

export interface Error {
    Message: string;
    Line: number;
    Column: number;
    EndLine: number;
    EndColumn: number;
    FileName: string;
}

export interface ErrorResponse {
    Errors: Error[];
}

export interface QuickFix {
    LogLevel: string;
    FileName: string;
    Line: number;
    Column: number;
    EndLine: number;
    EndColumn: number;
    Text: string;
    Projects: string[];
}

export interface SymbolLocation extends QuickFix {
    Kind: string;
}

export interface QuickFixResponse {
    QuickFixes: QuickFix[];
}

export interface FindSymbolsResponse {
    QuickFixes: SymbolLocation[];
}

export interface TypeLookupRequest extends Request {
    IncludeDocumentation: boolean;
}

export interface TypeLookupResponse {
    Type: string;
    Documentation: string;
}

export interface RunCodeActionResponse {
    Text: string;
    Changes: TextChange[];
}

export interface GetCodeActionsResponse {
    CodeActions: string[];
}

export interface SyntaxFeature {
    Name: string;
    Data: string;
}

export interface Node {
    ChildNodes: Node[];
    Location: QuickFix;
    Kind: string;
    Features: SyntaxFeature[];
}

export interface CurrentFileMembersAsTreeResponse {
    TopLevelTypeDefinitions: Node[];
}

export interface AutoCompleteRequest extends Request {
    WordToComplete: string;
    WantDocumentationForEveryCompletionResult?: boolean;
    WantImportableTypes?: boolean;
    WantMethodHeader?: boolean;
    WantSnippet?: boolean;
    WantReturnType?: boolean;
    WantKind?: boolean;
}

export interface AutoCompleteResponse {
    CompletionText: string;
    Description: string;
    DisplayText: string;
    RequiredNamespaceImport: string;
    MethodHeader: string;
    ReturnType: string;
    Snippet: string;
    Kind: string;
}

export interface ProjectInformationResponse {
    MsBuildProject: MSBuildProject;
    DotNetProject: DotNetProject;
}

export interface WorkspaceInformationResponse {
    MsBuild?: MsBuildWorkspaceInformation;
    DotNet?: DotNetWorkspaceInformation;
    ScriptCs?: ScriptCsContext;
}

export interface MsBuildWorkspaceInformation {
    SolutionPath: string;
    Projects: MSBuildProject[];
}

export interface ScriptCsContext {
    CsxFiles: { [n: string]: string };
    References: { [n: string]: string };
    Usings: { [n: string]: string };
    ScriptPacks: { [n: string]: string };
    Path: string;
}

export interface MSBuildProject {
    ProjectGuid: string;
    Path: string;
    AssemblyName: string;
    TargetPath: string;
    TargetFramework: string;
    SourceFiles: string[];
    TargetFrameworks: TargetFramework[];
    OutputPath: string;
    IsExe: boolean;
    IsUnityProject: boolean;
}

export interface TargetFramework {
    Name: string;
    FriendlyName: string;
    ShortName: string;
}

export interface DotNetWorkspaceInformation {
    Projects: DotNetProject[];
    RuntimePath: string;
}

export interface DotNetProject {
    Path: string;
    Name: string;
    ProjectSearchPaths: string[];
    Configurations: DotNetConfiguration[];
    Frameworks: DotNetFramework[];
    SourceFiles: string[];
}

export interface DotNetConfiguration {
    Name: string;
    CompilationOutputPath: string;
    CompilationOutputAssemblyFile: string;
    CompilationOutputPdbFile: string;
    EmitEntryPoint?: boolean;
}

export interface DotNetFramework {
    Name: string;
    FriendlyName: string;
    ShortName: string;
}

export interface RenameRequest extends Request {
    RenameTo: string;
    WantsTextChanges?: boolean;
}

export interface ModifiedFileResponse {
    FileName: string;
    Buffer: string;
    Changes: TextChange[];
}

export interface RenameResponse {
    Changes: ModifiedFileResponse[];
}

export interface SignatureHelp {
    Signatures: SignatureHelpItem[];
    ActiveSignature: number;
    ActiveParameter: number;
}

export interface SignatureHelpItem {
    Name: string;
    Label: string;
    Documentation: string;
    Parameters: SignatureHelpParameter[];
}

export interface SignatureHelpParameter {
    Name: string;
    Label: string;
    Documentation: string;
}

export interface MSBuildProjectDiagnostics {
    FileName: string;
    Warnings: MSBuildDiagnosticsMessage[];
    Errors: MSBuildDiagnosticsMessage[];
}

export interface MSBuildDiagnosticsMessage {
    LogLevel: string;
    FileName: string;
    Text: string;
    StartLine: number;
    StartColumn: number;
    EndLine: number;
    EndColumn: number;
}

export interface ErrorMessage {
    Text: string;
    FileName: string;
    Line: number;
    Column: number;
}

export interface PackageRestoreMessage {
    FileName: string;
    Succeeded: boolean;
}

export interface UnresolvedDependenciesMessage {
    FileName: string;
    UnresolvedDependencies: PackageDependency[];
}

export interface PackageDependency {
    Name: string;
    Version: string;
}

export namespace V2 {

    export module Requests {
        export const Completion = '/v2/completion';
        export const CompletionItemResolve = '/v2/completionItem/resolve';
        export const GetCodeActions = '/v2/getcodeactions';
        export const RunCodeAction = '/v2/runcodeaction';
        export const GetTestStartInfo = '/v2/getteststartinfo';
        export const RunTest = '/v2/runtest';
        export const DebugTestGetStartInfo = '/v2/debugtest/getstartinfo';
        export const DebugTestLaunch = '/v2/debugtest/launch';
        export const DebugTestStop = '/v2/debugtest/stop';
    }

    export module CompletionTriggerKind {
        export const Invoke = 'Invoke';
        export const Insertion = 'Insertion';
        export const Deletion = 'Deletion';
    }

    export interface CompletionTrigger {
        Kind: string;
        Character?: string;
    }

    export interface CompletionRequest extends FileBasedRequest {
        Position: number;
        Trigger: CompletionTrigger;
    }

    export interface CompletionItem {
        DisplayText: string;
        Kind: string;
        FilterText: string;
        SortText: string;
        Description?: string;
        TextEdit?: TextEdit;
        AdditionalTextEdits: TextEdit[];
    }

    export interface CompletionResponse {
        IsSuggestionMode: boolean;
        Items: CompletionItem[];
    }

    export interface CompletionItemResolveRequest extends FileBasedRequest {
        ItemIndex: number;
        DisplayText: string;
    }

    export interface CompletionItemResolveResponse {
        Item: CompletionItem;
    }

    export interface Point {
        Line: number;
        Column: number;
    }

    export function toPosition(point: Point): vscode.Position {
        return new vscode.Position(point.Line - 1, point.Column - 1);
    }

    export interface Range {
        Start: Point;
        End: Point;
    }

    export function toRange(range: Range): vscode.Range {
        return new vscode.Range(toPosition(range.Start), toPosition(range.End));
    }

    export interface TextEdit {
        Range: Range;
        NewText: string;
    }

    export interface GetCodeActionsRequest extends Request {
        Selection: Range;
    }

    export interface OmniSharpCodeAction {
        Identifier: string;
        Name: string;
    }

    export interface GetCodeActionsResponse {
        CodeActions: OmniSharpCodeAction[];
    }

    export interface RunCodeActionRequest extends Request {
        Identifier: string;
        Selection: Range;
        WantsTextChanges: boolean;
    }

    export interface RunCodeActionResponse {
        Changes: ModifiedFileResponse[];
    }


    export interface MSBuildProjectDiagnostics {
        FileName: string;
        Warnings: MSBuildDiagnosticsMessage[];
        Errors: MSBuildDiagnosticsMessage[];
    }

    export interface MSBuildDiagnosticsMessage {
        LogLevel: string;
        FileName: string;
        Text: string;
        StartLine: number;
        StartColumn: number;
        EndLine: number;
        EndColumn: number;
    }

    export interface ErrorMessage {
        Text: string;
        FileName: string;
        Line: number;
        Column: number;
    }

    export interface PackageRestoreMessage {
        FileName: string;
        Succeeded: boolean;
    }

    export interface UnresolvedDependenciesMessage {
        FileName: string;
        UnresolvedDependencies: PackageDependency[];
    }

    export interface PackageDependency {
        Name: string;
        Version: string;
    }

    // dotnet-test endpoints
    export interface DebugTestGetStartInfoRequest extends Request {
        MethodName: string;
        TestFrameworkName: string;
    }

    export interface DebugTestGetStartInfoResponse {
        FileName: string;
        Arguments: string;
        WorkingDirectory: string;
        EnvironmentVariables: Map<string, string>;
    }

    export interface DebugTestLaunchRequest extends Request {
        TargetProcessId: number;
    }

    export interface DebugTestLaunchResponse {
    }

    export interface DebugTestStopRequest extends Request {
    }

    export interface DebugTestStopResponse {
    }

    export interface GetTestStartInfoRequest extends Request {
        MethodName: string;
        TestFrameworkName: string;
    }

    export interface GetTestStartInfoResponse {
        Executable: string;
        Argument: string;
        WorkingDirectory: string;
    }

    export interface RunTestRequest extends Request {
        MethodName: string;
        TestFrameworkName: string;
    }

    export module TestOutcomes {
        export const None = 'none';
        export const Passed = 'passed';
        export const Failed = 'failed';
        export const Skipped = 'skipped';
        export const NotFound = 'notfound';
    }

    export interface DotNetTestResult {
        MethodName: string;
        Outcome: string;
        ErrorMessage: string;
        ErrorStackTrace: string;
    }

    export interface RunTestResponse {
        Failure: string;
        Pass: boolean;
        Results: DotNetTestResult[];
    }

    export interface TestMessageEvent {
        MessageLevel: string;
        Message: string;
    }
}

export function findNetCoreAppTargetFramework(project: MSBuildProject): TargetFramework {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netcoreapp'));
}

export function findNetStandardTargetFramework(project: MSBuildProject): TargetFramework {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netstandard'));
}

export interface ProjectDescriptor {
    Name: string;
    Directory: string;
    FilePath: string;
}

export function getDotNetCoreProjectDescriptors(info: WorkspaceInformationResponse): ProjectDescriptor[] {
    let result = [];

    if (info.DotNet && info.DotNet.Projects.length > 0) {
        for (let project of info.DotNet.Projects) {
            result.push({
                Name: project.Name,
                Directory: project.Path,
                FilePath: path.join(project.Path, 'project.json')
            });
        }
    }

    if (info.MsBuild && info.MsBuild.Projects.length > 0) {
        for (let project of info.MsBuild.Projects) {
            if (findNetCoreAppTargetFramework(project) !== undefined ||
                findNetStandardTargetFramework(project) !== undefined) {
                result.push({
                    Name: path.basename(project.Path),
                    Directory: path.dirname(project.Path),
                    FilePath: project.Path
                });
            }
        }
    }

    return result;
}