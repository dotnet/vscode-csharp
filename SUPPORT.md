# Support

## How to get help

This project uses GitHub Issues to track bugs and feature requests. Please search the [existing issues](https://github.com/dotnet/vscode-csharp/issues) before filing new issues to avoid duplicates. For new issues, file your bug or feature request as a new Issue.

This repository tracks issues related to the C# extension.  Any issues related to the C# editing experience, Roslyn language server and other basic C# functionality should be filed here (regardless of if you're using C# Dev Kit or not).

For C# Dev Kit only features such as the Solution Explorer, Test Window, etc, please see https://github.com/microsoft/vscode-dotnettools/blob/main/SUPPORT.md

For help and questions about using this project, please see the [README](https://github.com/dotnet/vscode-csharp/blob/main/README.md).

### How to file an issue

We highly recommend using the C# extension's built-in command, `CSharp: Report an issue` (`csharp.reportIssue`) to create a pre-filled issue template.  This will include helpful details such as local dotnet installations, installed extensions, and other information.

![csharp.reportIssue command](./docs/images/report_issue.png)

#### Capturing activity trace logging

When investigating issues, the C# extension provides a command to collect logs, activity logs, traces, and dumps. This is the recommended way to collect diagnostic information as it automatically captures all relevant files in a single archive.

1. **Invoke the Collect Logs Command**:
   - Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS).
   - Search for and select `CSharp: Collect C# Logs` (`csharp.collectLogs`).

   ![alt text](docs/images/collect_logs.png)
2. **Select Additional Logs to Collect**:
   - You will be presented with a multi-select picker. Choose from:
     - **Record Activity** - Capture live C#, LSP trace, and Razor log output
     - **Performance Trace** - Record a dotnet-trace of the language server
     - **Memory Dump** - Process memory dump using dotnet-dump
     - **GC Dump** - Garbage collector heap dump using dotnet-gcdump

   ![alt text](docs/images/choose_additional_logs.png)
3. **Customize Arguments**:
   - For each selected tool (dotnet-trace, dotnet-dump, dotnet-gcdump), you will be prompted to review and customize the arguments.
4. **Choose Where to Save**:
   - You will be prompted to choose a save location for the log archive. Choose a location to save the `.zip` file.
4. **Reproduce the Issue**:
   - If you selected Record Activity or Performance Trace, a notification will appear indicating that recording is in progress.
   - While the notification is visible, perform the actions that reproduce the issue.
   - The extension automatically sets the log level to `Trace` during capture to collect detailed information.
   - Click the `Cancel` button on the notification to stop recording.
5. **Zip File is Saved**:
   - You will be notified that the archive has been saved and a button is provided to open the containing folder.
6. **Share the Logs**:
   - The saved archive may contain (depending on selections):
     - `csharp.log` - The existing C# log file
     - `csharp-lsp-trace.log` - The existing LSP trace log file
     - `razor.log` - The existing Razor log file
     - `csharp.activity.log` - Captured C# log activity during the recording session
     - `csharp-lsp-trace.activity.log` - Captured LSP trace activity during the recording session
     - `razor.activity.log` - Captured Razor log activity during the recording session
     - `csharp-settings.json` - Current C# extension settings
     - `.nettrace` file from dotnet-trace (if Performance Trace selected)
     - `.dmp` memory dump files (if Memory Dump selected)
     - `.gcdump` GC dump files (if GC Dump selected)
   - Attach the archive to your GitHub issue or share it privately (see [Sharing information privately](#sharing-information-privately)).

> [!WARNING]
> The logs may contain file paths, project names, and other workspace information. Review the contents before sharing publicly.

##### Setting Trace Levels Manually

If you need to set the trace level manually:

- **In the C# output window** (`View` -> `Output`), set the log level to `Trace`.

  ![c# output window showing trace option](./docs/images/csharp_trace.png)

- **In the C# LSP Trace Logs output window**, set the log level to `Trace`.

**Other Ways to Set the Log Level**:
- When launching VS Code from the CLI, pass the `--log ms-dotnettools.csharp:trace` parameter.
- Invoke the `Developer: Set Log Level` command from the VS Code command palette, find the `C#` entry, and set the level.

#### Collecting Razor Logs
For issues with Razor, the Razor Log output window can contain useful information.

1. **Set the Log Level to Trace**:
   - Open the `Razor Logs` output window (`View` -> `Output`).
   - Set the log level to `Trace`.

     ![razor log output window showing trace option](./docs/images/razor_logs.png)

2. **Reproduce the Issue**:
   - Perform the actions that reproduce the issue.

3. **Copy the Logs**:
   - Select all contents of the window (e.g., `Ctrl+A`) and paste them into the GitHub issue when requested.

4. **Reset the Log Level**:
   - Once the logs are collected, reset the log level to `Info`.

### Project Loading Problems

Missing language features are often caused by a failure to load the project(s) or solution. To diagnose and resolve these issues, follow these steps:

1. **Provide General Logs**:
   - Include the information from the issue template and the general logs (see the "Capturing activity trace logging" section above). These logs are essential for troubleshooting.

2. **Check the Active Project Context**:
   - Verify that the file is associated with the correct project in the language server.
   - This information is displayed in the bottom-right corner of the VSCode window in the language status section.
   - You can pin this item using the pin icon to keep it visible at all times.

     ![language status bar showing file active project context](./docs/images/language_status.png)

3. **Verify the Solution Explorer (C# Dev Kit)**:
   - If you are using C# Dev Kit, check the Solution Explorer to ensure the project is displayed with the expected references.
   - If the references or structure are not as expected, include the contents of the `Projects` output window in your issue report.

### Colorization problems
If you encounter issues with document classification (e.g., incorrect syntax highlighting or colorization), please provide the following information to help us diagnose the problem:

1. **Theme in Use**:
   - Specify the name of the theme you are currently using in VSCode (e.g., "Dark+", "Light+", or a custom theme).

2. **Tokens and Scope Information**:
   - The `Developer: Inspect Editor Tokens and Scopes` command shows information about the problematic word or section:
     1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS).
     2. Search for and select `Developer: Inspect Editor Tokens and Scopes` (`editor.action.inspectTMScopes`).
     3. Click on the word or section with incorrect colorization to display the token and scope information.
   - Take a screenshot of the output and include it in your issue report.

     ![Inspect Tokens and Scopes Output](./docs/images/inspect_tokens.png)

### Diagnostics problems

For issues with diagnostics, please provide values of the background analysis scope options, `dotnet.backgroundAnalysis.analyzerDiagnosticsScope` and `dotnet.backgroundAnalysis.compilerDiagnosticsScope`

![background analysis settings](./docs/images/background_analysis.png)

### Language server crashing

If the language server crashes, general logs are often helpful for diagnosing the issue. However, in some cases, logs alone may not provide enough information and we may need a crash dump. Follow these steps to collect a crash dump:
- Set the `dotnet.server.crashDumpPath` setting in VSCode to a user-writable folder where crash dumps can be saved.
- Reproduce the issue
- When the server crashes, a dump in the specified folder will be created.

> [!WARNING]
> The dump will contain detailed information about the workspace.  See [Sharing information privately](#sharing-information-privately)

### Sharing information privately
Detailed logs, dumps, traces, and other information can sometimes contain private information that you do not wish to share publicly on GitHub (for example file paths and file contents).  Instead, you can utilize the Developer Community page to share these privately to Microsoft.

1.  Go to https://developercommunity.visualstudio.com/dotnet/report
2.  Fill in the issue title, reference the GitHub issue in the description, and upload the attachments.  Note that there is a 2 GB limit on attached files.  Dumps can often be larger than that, so we recommend compressing them to a `.zip` before uploading.

![developer community feedback page](docs/images/developer_community_feedback.png)
4.  Once created, a comment on the GitHub issue a link to the new Developer Community ticket.



## Microsoft Support Policy

Support for this project is limited to the resources listed above.
