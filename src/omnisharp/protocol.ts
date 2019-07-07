/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

export module Requests {
    export const AddToProject = '/addtoproject';
    export const AutoComplete = '/autocomplete';
    export const CodeCheck = '/codecheck';
    export const CodeFormat = '/codeformat';
    export const ChangeBuffer = '/changebuffer';
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
    export const ReAnalyze = '/reanalyze';
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
    MaxItemsToReturn?: number;
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
    Tags: string[];
    Id: string;
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

export interface DocumentationItem {
    Name: string;
    Documentation: string;
}

export interface DocumentationComment {
    SummaryText: string;
    TypeParamElements: DocumentationItem[];
    ParamElements: DocumentationItem[];
    ReturnsText: string;
    RemarksText: string;
    ExampleText: string;
    ValueText: string;
    Exception: DocumentationItem[];
}

export interface TypeLookupRequest extends Request {
    IncludeDocumentation: boolean;
}

export interface TypeLookupResponse {
    Type: string;
    Documentation: string;
    StructuredDocumentation: DocumentationComment;
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

export interface AutoCompleteRequest extends Request {
    WordToComplete: string;
    WantDocumentationForEveryCompletionResult?: boolean;
    WantImportableTypes?: boolean;
    WantMethodHeader?: boolean;
    WantSnippet?: boolean;
    WantReturnType?: boolean;
    WantKind?: boolean;
    TriggerCharacter?: string;
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
    IsSuggestionMode: boolean;
    Preselect: boolean;
}

export interface ProjectInformationResponse {
    MsBuildProject: MSBuildProject;
    DotNetProject: DotNetProject;
}

export enum DiagnosticStatus
{
    Processing = 0,
    Ready = 1
}

export interface ProjectDiagnosticStatus {
    Status: DiagnosticStatus;
    ProjectFilePath: string;
    Type: "background";
}

export interface WorkspaceInformationResponse {
    MsBuild?: MsBuildWorkspaceInformation;
    DotNet?: DotNetWorkspaceInformation;
    ScriptCs?: ScriptCsContext;
    Cake?: CakeContext;
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

export interface CakeContext {
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
    ModificationType: FileModificationType;
}

export enum FileModificationType {
    Modified,
    Opened,
    Renamed,
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
    StructuredDocumentation: DocumentationComment;
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

export interface ProjectConfigurationMessage {
    ProjectId: string;
    TargetFrameworks: string[];
    References: string[];
    FileExtensions: string[];
}

export interface PackageDependency {
    Name: string;
    Version: string;
}

export interface FilesChangedRequest extends Request {
    ChangeType: FileChangeType;
}

export enum FileChangeType {
    Change = "Change",
    Create = "Create",
    Delete = "Delete"
}

export namespace V2 {

    export module Requests {
        export const GetCodeActions = '/v2/getcodeactions';
        export const RunCodeAction = '/v2/runcodeaction';
        export const GetTestStartInfo = '/v2/getteststartinfo';
        export const RunTest = '/v2/runtest';
        export const RunAllTestsInClass = "/v2/runtestsinclass";
        export const DebugTestGetStartInfo = '/v2/debugtest/getstartinfo';
        export const DebugTestsInClassGetStartInfo = '/v2/debugtestsinclass/getstartinfo';
        export const DebugTestLaunch = '/v2/debugtest/launch';
        export const DebugTestStop = '/v2/debugtest/stop';
        export const BlockStructure = '/v2/blockstructure';
        export const CodeStructure = '/v2/codestructure';
    }

    export interface Point {
        Line: number;
        Column: number;
    }

    export interface Range {
        Start: Point;
        End: Point;
    }

    export interface GetCodeActionsRequest extends Request {
        Selection?: Range;
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
        Selection?: Range;
        WantsTextChanges: boolean;
        WantsAllCodeActionOperations: boolean;
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
        TargetFrameworkVersion: string;
    }

    export interface DebugTestClassGetStartInfoRequest extends Request {
        MethodNames: string[];
        TestFrameworkName: string;
        TargetFrameworkVersion: string;
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
        TargetFrameworkVersion: string;
    }

    export interface GetTestStartInfoResponse {
        Executable: string;
        Argument: string;
        WorkingDirectory: string;
    }

    export interface RunTestRequest extends Request {
        MethodName: string;
        TestFrameworkName: string;
        TargetFrameworkVersion: string;
    }

    export interface RunTestsInClassRequest extends Request {
        MethodNames: string[];
        TestFrameworkName: string;
        TargetFrameworkVersion: string;
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
        StandardOutput: string[];
        StandardError: string[];
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

    export interface BlockStructureRequest {
        FileName: string;
    }

    export interface BlockStructureResponse {
        Spans: CodeFoldingBlock[];
    }

    export interface CodeFoldingBlock {
        Range: Range;
        Kind: string;
    }

    export module SymbolKinds {
        // types
        export const Class = 'class';
        export const Delegate = 'delegate';
        export const Enum = 'enum';
        export const Interface = 'interface';
        export const Struct = 'struct';

        // members
        export const Constant = 'constant';
        export const Constructor = 'constructor';
        export const Destructor = 'destructor';
        export const EnumMember = 'enummember';
        export const Event = 'event';
        export const Field = 'field';
        export const Indexer = 'indexer';
        export const Method = 'method';
        export const Operator = 'operator';
        export const Property = 'property';

        // other
        export const Namespace = 'namespace';
        export const Unknown = 'unknown';
    }

    export module SymbolAccessibilities {
        export const Internal = 'internal';
        export const Private = 'private';
        export const PrivateProtected = 'private protected';
        export const Protected = 'protected';
        export const ProtectedInternal = 'protected internal';
        export const Public = 'public';
    }

    export module SymbolPropertyNames {
        export const Accessibility = 'accessibility';
        export const Static = 'static';
        export const TestFramework = 'testFramework';
        export const TestMethodName = 'testMethodName';
    }

    export module SymbolRangeNames {
        export const Attributes = 'attributes';
        export const Full = 'full';
        export const Name = 'name';
    }

    export namespace Structure {
        export interface CodeElement {
            Kind: string;
            Name: string;
            DisplayName: string;
            Children?: CodeElement[];
            Ranges: { [name: string]: Range };
            Properties?: { [name: string]: any };
        }

        export interface CodeStructureRequest extends FileBasedRequest {
        }

        export interface CodeStructureResponse {
            Elements?: CodeElement[];
        }

        export function walkCodeElements(elements: CodeElement[], action: (element: CodeElement, parentElement?: CodeElement) => void) {
            function walker(elements: CodeElement[], parentElement?: CodeElement) {
                for (let element of elements) {
                    action(element, parentElement);

                    if (element.Children) {
                        walker(element.Children, element);
                    }
                }
            }

            walker(elements);
        }
    }
}

export function findNetFrameworkTargetFramework(project: MSBuildProject): TargetFramework {
    let regexp = new RegExp('^net[1-4]');
    return project.TargetFrameworks.find(tf => regexp.test(tf.ShortName));
}

export function findNetCoreAppTargetFramework(project: MSBuildProject): TargetFramework {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netcoreapp'));
}

export function findNetStandardTargetFramework(project: MSBuildProject): TargetFramework {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netstandard'));
}

export function isDotNetCoreProject(project: MSBuildProject): Boolean {
    return findNetCoreAppTargetFramework(project) !== undefined ||
        findNetStandardTargetFramework(project) !== undefined ||
        findNetFrameworkTargetFramework(project) !== undefined;
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
            if (isDotNetCoreProject(project)) {
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

export function findExecutableMSBuildProjects(projects: MSBuildProject[]) {
    let result: MSBuildProject[] = [];

    projects.forEach(project => {
        if (project.IsExe && findNetCoreAppTargetFramework(project) !== undefined) {
            result.push(project);
        }
    });

    return result;
}
