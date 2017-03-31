## Known Issues

* Running and debugging of tests are not supported in .csproj-based .NET Core projects. However, there will still be clickable "run test" and "debug test" indicators above test methods. ([#1100](https://github.com/OmniSharp/omnisharp-vscode/issues/1100))
* When opening a .csproj-based .NET Core project in VS Code, the C# extension will not activate until a C# file is opened in the editor. ([#1150](https://github.com/OmniSharp/omnisharp-vscode/issues/1150))
* There currently is no completion support for package references in csproj files. ([#1156](https://github.com/OmniSharp/omnisharp-vscode/issues/1156))

## 1.8.1 (March 31, 2017)

Fixes debugging on macOS Sierra 10.12.4.

## 1.8.0 (March 10, 2017)

#### Go to Implementation

* Added support for "Go to Implementation" and "Peek Implementation" introduced in Visual Studio Code 1.9. ([#37](https://github.com/OmniSharp/omnisharp-vscode/issues/37)) _(Contributed by [@ivanz](https://github.com/ivanz))_

#### Scripting

* C# scripts (.csx files) now allow multiple `#load` directives, and `#r` and `#load` directives update live. ([omnisharp-roslyn#760](https://github.com/OmniSharp/omnisharp-roslyn/pull/760)) _(Contributed by [@filipw](https://github.com/filipw))_
* .csx files can now be discovered as valid launch targets using the project selector at the bottom-right of the status bar. ([#1247](https://github.com/OmniSharp/omnisharp-vscode/pull/1247)) _(Contributed by [@filipw](https://github.com/filipw))_
* Assembly references will now unify properly for C# scripts. ([omnisharp-roslyn#764](https://github.com/OmniSharp/omnisharp-roslyn/pull/764)) _(Contributed by [@filipw](https://github.com/filipw))_
* Unsafe code is now allowed in C# scripts. ([omnisharp-roslyn#781](https://github.com/OmniSharp/omnisharp-roslyn/pull/781)) _(Contributed by [@filipw](https://github.com/filipw))_
* C# scripting now ignores duplicated CorLibrary types, which can manifest in certain edge scenarios. ([omnisharp-roslyn#784](https://github.com/OmniSharp/omnisharp-roslyn/pull/784)) _(Contributed by [@filipw](https://github.com/filipw))_

#### Debugger

The 1.8 release makes a major change to how the debugger works under the hood. This new architecture simplifies how the debugger is tied to VS Code. We hope that this will make it easier to bring .NET debugging features to VS Code. We also expect it to improve debugger launch performance.

Changes:

* The module load messages in the output window are now more detailed and hopefully less confusing. ([#837](https://github.com/OmniSharp/omnisharp-vscode/issues/837))
* Programs can now be launched into VS Code's integrated terminal. ([documentation](https://github.com/OmniSharp/omnisharp-vscode/blob/master/debugger.md#console-terminal-window))
* VS Code recently introduced [column breakpoint support](https://code.visualstudio.com/updates/v1_10#_column-breakpoints) and they are now enabled for C#.
* React to the VS Code change to use `${command:` instead of `${command.`. ([#1275](https://github.com/OmniSharp/omnisharp-vscode/issues/1275))
* Fix a problem with browser launch support that could lead to debugger session's being aborted when the browser is started. ([#1274](https://github.com/OmniSharp/omnisharp-vscode/issues/1274))
* Remote debugging breaking changes: as part of our new architecture, there are a few breaking changes to the way remote debugging works.

    * vsdbg vs. clrdbg: As part of the new architecture, clrdbg has been replaced with a new executable named vsdbg. As such, the script to download vsdbg has changed to http://aka.ms/getvsdbgsh. Run `curl -sSL https://aka.ms/getvsdbgsh | bash /dev/stdin -v latest -l ~/vsdbg` to download. See the [wiki](https://github.com/OmniSharp/omnisharp-vscode/wiki/Attaching-to-remote-processes) for more information.
    * Pseudo-tty's are no longer supported: previously we were a little more tolerant of pseudo-tty's transforming the input/output from the remote debugger. We are currently not as tolerant. If you are using `ssh` or `plink` as a pipe program, pass `-T` to fix this. If you have another transport and you are no longer able to connect, let us know and we can fix this for a future release.
    * `debuggerPath` is now required - previously the `debuggerPath` property of `pipeTransport` was recomended but not required. As part of this change we are now requiring it.

#### Other Updates and Fixes

* Find All References now properly highlights locations of found references. ([#428](https://github.com/OmniSharp/omnisharp-vscode/issues/428))
* Assembly references will now unify properly for project.json projects. ([#1221](https://github.com/OmniSharp/omnisharp-vscode/issues/1221))
* Code Actions (i.e. refactorings and fixes) now respect the formatting options that are set when a project is opened. ([omnisharp-roslyn#759](https://github.com/OmniSharp/omnisharp-roslyn/issues/759)) _(Contributed by [@filipw](https://github.com/filipw))_
* Completion support for package references in project.json files has been restored. ([#1236](https://github.com/OmniSharp/omnisharp-vscode/pull/1236))
* The C# TextMate grammar used for syntax highlighting has been removed because it is now part of Visual Studio Code itself. ([#1206](https://github.com/OmniSharp/omnisharp-vscode/issues/1206)) _(Many thanks to [@aeschli](https://github.com/aeschli))_

## 1.7.0 (February 8, 2017)

#### Syntax Hightlighting

* Introduced a brand new TextMate grammar written from scratch that provides much more robust C# syntax highlighting. ([#101](https://github.com/OmniSharp/omnisharp-vscode/issues/101), [#225](https://github.com/OmniSharp/omnisharp-vscode/issues/225), [#268](https://github.com/OmniSharp/omnisharp-vscode/issues/268), [#316](https://github.com/OmniSharp/omnisharp-vscode/issues/316), [#674](https://github.com/OmniSharp/omnisharp-vscode/issues/674), [#706](https://github.com/OmniSharp/omnisharp-vscode/issues/706), [#731](https://github.com/OmniSharp/omnisharp-vscode/issues/731), [#746](https://github.com/OmniSharp/omnisharp-vscode/issues/746), [#782](https://github.com/OmniSharp/omnisharp-vscode/issues/782), [#802](https://github.com/OmniSharp/omnisharp-vscode/issues/802), [#816](https://github.com/OmniSharp/omnisharp-vscode/issues/816), [#829](https://github.com/OmniSharp/omnisharp-vscode/issues/829), [#830](https://github.com/OmniSharp/omnisharp-vscode/issues/830), [#861](https://github.com/OmniSharp/omnisharp-vscode/issues/861), [#1078](https://github.com/OmniSharp/omnisharp-vscode/issues/1078), [#1084](https://github.com/OmniSharp/omnisharp-vscode/issues/1084), [#1086](https://github.com/OmniSharp/omnisharp-vscode/issues/1086), [#1091](https://github.com/OmniSharp/omnisharp-vscode/issues/1091), [#1096](https://github.com/OmniSharp/omnisharp-vscode/issues/1096), [#1097](https://github.com/OmniSharp/omnisharp-vscode/issues/1097), [#1106](https://github.com/OmniSharp/omnisharp-vscode/issues/1106), [#1115](https://github.com/OmniSharp/omnisharp-vscode/issues/1108))
* The C# TextMate grammar has a new home! Issues and contributions are welcome at [https://github.com/dotnet/csharp-tmLanguage](https://github.com/dotnet/csharp-tmLanguage).

#### Project Support

* Updated with the latest changes for .NET Core .csproj projects. ([omnisharp-roslyn#738](https://github.com/OmniSharp/omnisharp-roslyn/pull/738))
* Automatic package restore and out-of-date notifications implemented for .NET Core .csproj projects. ([#770](https://github.com/OmniSharp/omnisharp-vscode/issues/770))
* Correctly update project when dotnet restore is performed on a .NET Core .csproj project. ([#1114](https://github.com/OmniSharp/omnisharp-vscode/issues/1114))
* Properly handle .csproj projects in .sln files that were added via .NET CLI commands. ([omnisharp-roslyn#741](https://github.com/OmniSharp/omnisharp-roslyn/pull/741))
* Fix `dotnet restore` Visual Studio Code command to execute for .csproj .NET Core projects. ([#1175](https://github.com/OmniSharp/omnisharp-vscode/issues/1175))
* Respect `nowarn` in project.json projects. ([omnisharp#734](https://github.com/OmniSharp/omnisharp-roslyn/pull/734)) _(Contributed by [@filipw](https://github.com/filipw))_
* Fix problem with project.json projects that wrap assemblies. ([#424](https://github.com/OmniSharp/omnisharp-vscode/issues/424))

#### Debugging

* Enable debugger support for Zorin OS 12. ([#1160](https://github.com/OmniSharp/omnisharp-vscode/issues/1160)) _(Contributed by [@mkaziz](https://github.com/mkaziz))_
* Added off-road support for [Windows Subsystem for Linux](https://blogs.msdn.microsoft.com/wsl/2016/04/22/windows-subsystem-for-linux-overview/) (NOTE: requires newer version of Windows than have been publicly released yet)
* Fixed issue with debugger pause and multithreaded call stacks ([#1107](https://github.com/OmniSharp/omnisharp-vscode/issues/1107) and [#1105](https://github.com/OmniSharp/omnisharp-vscode/issues/1105))

#### C# Scripting

* Support resolving `#r` references from the GAC. ([omnisharp-roslyn#721](https://github.com/OmniSharp/omnisharp-roslyn/pull/721)) _(Contributed by [@filipw](https://github.com/filipw))_
* Include System.ValueTuple in C# scripts implicitly. ([omnisharp-roslyn#722](https://github.com/OmniSharp/omnisharp-roslyn/pull/722)) _(Contributed by [@filipw](https://github.com/filipw))_

#### Code Actions

* Fixed code actions that add files, such as "Move Type to File". ([#975](https://github.com/OmniSharp/omnisharp-vscode/issues/975))
* Properly surface code actions that have "nested code actions". This allows "generate type" to work properly. ([#302](https://github.com/OmniSharp/omnisharp-vscode/issues/302))
* Don't display the Remove Unnecessary Usings code action unless it is relevant. ([omnisharp-roslyn#742](https://github.com/OmniSharp/omnisharp-roslyn/issues/742))
* Don't show the Extract Interface refactoring as it requires a dialog that does not exist in VS Code. ([#925](https://github.com/OmniSharp/omnisharp-vscode/issues/925))

#### Completion List

* A namespace icon should be displayed for namespaces in the completion list. ([#1125](https://github.com/OmniSharp/omnisharp-vscode/issues/1124)) _(Contributed by [@filipw](https://github.com/filipw))_
* Add icons for several symbol kinds in the completion list, fixing many symbols that incorrectly displayed a property "wrench" icon. ([#1145](https://github.com/OmniSharp/omnisharp-vscode/issues/1145))

#### Other Updates and Fixes

* Add schema validation for omnisharp.json files. ([#1082](https://github.com/OmniSharp/omnisharp-vscode/pull/1082)) _(Contributed by [@Thaina](https://github.com/Thaina))_
* Add support for auto-closing and surrounding characters. ([#749](https://github.com/OmniSharp/omnisharp-vscode/issues/749), [#842](https://github.com/OmniSharp/omnisharp-vscode/issues/842)) _(Contributed by [@filipw](https://github.com/filipw))_
* Fix running and debugging of tests defined in nested classes. ([#743](https://github.com/OmniSharp/omnisharp-vscode/issues/743), [#1151](https://github.com/OmniSharp/omnisharp-vscode/issues/1151))
* Fix error when 'tasks.json' does not contain a 'tasks' node, or contains os-specific 'tasks' nodes. ([#1140](https://github.com/OmniSharp/omnisharp-vscode/issues/1140))
* Better detection of Windows architecture (x86 or x64) when determining extension dependencies to download. The detection logic now uses well-known environment variables rather than launching 'wmic'. ([#1110](https://github.com/OmniSharp/omnisharp-vscode/issues/1110), [#1125](https://github.com/OmniSharp/omnisharp-vscode/issues/1125))
* Improvements to the OmniSharp Log ([#1155](https://github.com/OmniSharp/omnisharp-vscode/pull/1155))
* Add new values to the `omnisharp.logginglevel` option to allow more granualar control of OmniSharp logging. ([#993](https://github.com/OmniSharp/omnisharp-vscode/issues/993)) _(Contributed by [@filipw](https://github.com/filipw))_
* Don't display the "some projects have trouble loading" message if projects only contain warnings. ([#707](https://github.com/OmniSharp/omnisharp-vscode/issues/707))
* Update Mono detection logic to succeed even if another shell is set as the default (e.g. zsh). ([#1031](https://github.com/OmniSharp/omnisharp-vscode/issues/1031))

## 1.6.2 (December 24, 2016)

* Fix performance issue when editing type names containing multiple generic type parameters. ([#1088](https://github.com/OmniSharp/omnisharp-vscode/issues/1088), [#1086](https://github.com/OmniSharp/omnisharp-vscode/issues/1086))

## 1.6.1 (December 22, 2016)

* Fix crash when tasks.json contains comments. ([#1074](https://github.com/OmniSharp/omnisharp-vscode/issues/1074))

## 1.6.0 (December 21, 2016)

#### C# Scripting

* Roslyn scripting support in CSX files! ([#23](https://github.com/OmniSharp/omnisharp-vscode/issues/23), [omnisharp-roslyn#659](https://github.com/OmniSharp/omnisharp-roslyn/pull/659)) _(Contributed by [@filipw](https://github.com/filipw))_

#### Project Support

* Support for latest .NET Core .csproj projects updates. ([omnisharp-roslyn#705](https://github.com/OmniSharp/omnisharp-roslyn/pull/705))
* Update 'tasks.json' and 'launch.json' generation to support .NET Core .csproj projects. ([#767](https://github.com/OmniSharp/omnisharp-vscode/issues/767))
* Properly support `<NoWarn>` in MSBuild projects and specifically ignore the `CS1701` warning in .NET Core MSBuild projects. ([#967](https://github.com/OmniSharp/omnisharp-vscode/issues/967))
* Fix global.json-based project search to also the top-level folders specified by the `"projects"` property and not just their children. ([#904](https://github.com/OmniSharp/omnisharp-vscode/issues/904) and [#962](https://github.com/OmniSharp/omnisharp-vscode/issues/962))

#### Debugging

* Update the debugger so that the debugger itself runs on .NET Core 1.1. This change:
    * Enables debugger support for additional Linux distributions - Ubuntu 16.10, openSUSE 42, Fedora 24
    * Brings support for running all supported distros on top of Linux Kernel >= 4.6
* Enable debugger support for Arch Linux ([#564](https://github.com/OmniSharp/omnisharp-vscode/issues/564))
* Improve debugger install errors for macOS without openSSL symlinks ([#986](https://github.com/OmniSharp/omnisharp-vscode/pull/986)), and x86 Windows ([#998](https://github.com/OmniSharp/omnisharp-vscode/pull/998)).
* Improve debugger performance using precompiled debugger binaries  ([#896](https://github.com/OmniSharp/omnisharp-vscode/issues/896))([#971](https://github.com/OmniSharp/omnisharp-vscode/issues/971)).

#### Syntax Highlighting

* Tons of great syntax highlighting fixes and support! _(All contributed by [@ivanz](https://github.com/ivanz))_
    * Fix for field declarations. ([#757](https://github.com/OmniSharp/omnisharp-vscode/issues/757))
    * Fix for generic types with multiple type parameters. ([#960](https://github.com/OmniSharp/omnisharp-vscode/issues/960))
    * Proper support for interpolated strings (verbatim and non-verbatim). ([#852](https://github.com/OmniSharp/omnisharp-vscode/issues/852))
    * Fix for multi-line properties. ([#854](https://github.com/OmniSharp/omnisharp-vscode/issues/854))
    * Fixes for events, nested type references (e.g. `Root.IInterface<Something.Nested>`), variable declarations, nested classes, and fields spanning multiple lines

#### Hover Tooltips

* Improve display of hover tool tips for built-in C# types, such as `int` and `string`. ([#250](https://github.com/OmniSharp/omnisharp-vscode/issues/250)) _(Contributed by [@filipw](https://github.com/filipw))_
* Improve display of hover tool tips for nested classes. ([#394](https://github.com/OmniSharp/omnisharp-vscode/issues/394)) _(Contributed by [@filipw](https://github.com/filipw))_
* Fix spacing in hover tool tips around `<paramref/>` in XML doc comments. ([#672](https://github.com/OmniSharp/omnisharp-vscode/issues/672)) _(Contributed by [@filipw](https://github.com/filipw))_

#### Other Updates and Fixes

* Support for running/debugging NUnit tests ([#996](https://github.com/OmniSharp/omnisharp-vscode/pull/996)) _(Contributed by [@HexWrench](https://github.com/HexWrench))_
* Fix exception thrown when sending `/autocomplete` request to OmniSharp server in location where no completion items are available. ([#980](https://github.com/OmniSharp/omnisharp-vscode/issues/980))
* Add `omnisharp.maxProjectResults` setting to control the maximum number of projects to display in the 'Select Project' dropdown. The default is 250. ([#875](https://github.com/OmniSharp/omnisharp-vscode/issues/875)) _(Contributed by [@filipw](https://github.com/filipw))_
* Fix signature help display for constructors. ([#36](https://github.com/OmniSharp/omnisharp-vscode/issues/36)) _(Contributed by [@filipw](https://github.com/filipw))_
* Ensure that the `editor.insertSpaces` and `editor.tabSize` settings are passed to OmniSharp for formatting. Note that this behavior can be controlled with the `omnisharp.useEditorFormattingSettings` option, which defaults to true. ([#1055](https://github.com/OmniSharp/omnisharp-vscode/pull/1055)) _(Contributed by [@filipw](https://github.com/filipw))_

## 1.5.3 (November 21, 2016)

* Use value of `http.proxyStrictSSL` even when `http.proxy` is not set. ([#957](https://github.com/OmniSharp/omnisharp-vscode/issues/957))

## 1.5.2 (November 15, 2016)

* Ensure diagnostics are cleared in files when they are no longer needed. ([#858](https://github.com/OmniSharp/omnisharp-vscode/issues/858))
* Enqueue requests for diagnostics in visible editors when the extension starts up. ([#843](https://github.com/OmniSharp/omnisharp-vscode/issues/843))
* Provide fallback URLs for debugger downloads. ([#930](https://github.com/OmniSharp/omnisharp-vscode/issues/930))
* Properly require .NET Framework 4.6 in the OmniSharp.exe.config file to ensure that the user is displayed a dialog on Windows machines that don't have .NET Framework 4.6 installed. ([#937](https://github.com/OmniSharp/omnisharp-vscode/issues/937))
* Fix issue with installing on non-English installations of Windows. ([#938](https://github.com/OmniSharp/omnisharp-vscode/issues/938))
* Display platform information when acquiring runtime dependencies. ([#948](https://github.com/OmniSharp/omnisharp-vscode/issues/948))

## 1.5.1 (November 14, 2016)

* Fix to properly support `http.proxy` and `http.proxyStrictSSL` settings. ([#930](https://github.com/OmniSharp/omnisharp-vscode/issues/930))

## 1.5.0 (November 14, 2016)

#### Initial support for C# 7

* New C# 7 features like pattern-matching and tuples are now supported in VS Code editor. Note: To use tuples, you will need a reference to [this NuGet package](https://www.nuget.org/packages/System.ValueTuple).

#### Initial support for CSProj .NET Core Projects

* With the .NET Core SDK moving to embrace MSBuild and .csproj files over project.json, we've made sure the C# extension can handle the new format. This support is preliminary and there are still several features coming to smooth out the experience.

#### Broader OS Support for C# Code Editing

* This release dramatically changes the runtime that OmniSharp runs on, which allows it to be run an many more operating systems than before:

  * Windows: OmniSharp runs on the installed .NET Framework. In addition, OmniSharp now runs on 32-bit Windows!
  * macOS/Linux: OmniSharp runs on a custom embedded Mono runtime. Note: Mono does not need to be installed on the system for this to work.

#### Debugger

* Remote debugging is now supported for attach by using the `pipeTransport` launch.json option.
* Resolved issue with setting breakpoints when there are multple files with the same name (e.g. two 'Program.cs' files).

#### New Dependency Acquisition System

* This improves the acquisition and reliability of platform-specific OmniSharp and debugger dependencies.

#### New Settings

Several new settings have been added:

* `csharp.suppressDotnetRestoreNotification`: Suppress the notification window to perform a 'dotnet restore' when dependencies can't be resolved.
* `omnisharp.projectLoadTimeout`: The time Visual Studio Code will wait for the OmniSharp server to start. Time is expressed in seconds. _(Contributed by [@wjk](https://github.com/wjk))_

#### Colorizer

* A new unit testing framework for testing the colorizer grammer ([#742](https://github.com/OmniSharp/omnisharp-vscode/pull/742)) _(Contributed by [@ivanz](https://github.com/ivanz))_
* Single-line comments after preprocessor directives ([#762](https://github.com/OmniSharp/omnisharp-vscode/pull/762)) _(Contributed by [@damieng](https://github.com/damieng))_

#### Performance

* Major improvements have been made to editor performance. The communication with the OmniSharp server has been rewritten to allow long-running operations (such as gathering all errors and warnings) to queue while high priority operations (such as text buffer changes) run serially. ([#902](https://github.com/OmniSharp/omnisharp-vscode/pull/902)) _(Thanks to [@david-driscoll](https://github.com/david-driscoll) for his help with this change!)_

#### Other Improvements

* The prompt to generate assets for building and debugging can now be dismissed for a workspace permanently. In addition, a new `dotnet.generateAssets` command has been added to force regeneration of the assets. ([#635](https://github.com/OmniSharp/omnisharp-vscode/issues/635))
* Fix "running forever" issue for folder with multple .NET Core projects. ([#735](https://github.com/OmniSharp/omnisharp-vscode/issues/735)) _(Contributed by [@eamodio](https://github.com/eamodio))_
* `ctor` snippet is now more consistent with other code snippets. ([#849](https://github.com/OmniSharp/omnisharp-vscode/pull/849)) _(Contibuted by [@Eibx](https://github.com/Eibx))_
* Ampersands in file paths are now properly escaped on Windows ([#909](https://github.com/OmniSharp/omnisharp-vscode/pull/909)) _(Contributed by [@filipw](https://github.com/filipw))_

## 1.4.1 (September 1, 2016)

* This addresses an issue found and fixed by @sixpindin in which the legacy csharp.omnisharp and csharp.omnisharpUsesMono settings are no longer respected. These settings have been supplanted by the omnisharp.path and omnisharp.useMono settings but are still expected to work if specified.

## 1.4.0 (August 29, 2016)

#### Metadata as Source

* Go to Definition (<kbd>F12</kbd>) can now show a C#-like view for APIs that do not appear in your project's source code. ([#165](https://github.com/OmniSharp/omnisharp-vscode/issues/165))

#### Debugger

* Applications can now be launched without attaching the debugger with <kbd>Ctrl+F5</kbd>.
* Support for new "embedded portable PDB" debug format.
* The launch.json file generator now automatically sets the option to show a console window by default (`"internalConsoleOptions": "openOnSessionStart"`).

#### New Settings

Several new settings have been added:

* `csharp.suppressDotnetInstallWarning`: Suppress the warning that the .NET CLI is not on the path.
* `omnisharp.autoStart`: Used to control whether the OmniSharp server will be automatically launched when a folder containing a project or solution is opened. The default value for this setting is `true`.
* `omnisharp.path`: Can be used to specify a file path to a different OmniSharp server than the one that will be used by default. Previously, this option was controlled by `csharp.omnisharp`, which is now deprecated.
* `omnisharp.useMono`: When `omnisharp.path` is specified, this controls whether OmniSharp will be launched with Mono or not. Previously, this option was controlled by `csharp.omnisharpUsesMono`, wich is now deprecated.
* `omnisharp.loggingLevel`: Used to control the level of logging output from the OmniSharp server. Legal values are `"default"` or `"verbose"`.

#### Colorizer

There have been several fixes to the colorizer grammar resulting in much smoother syntax highlighting, with better support for C# 6.0. Special thanks go to [@ivanz](https://github.com/ivanz) and [@seraku24](https://github.com/seraku24) for contributing most of the fixes below!

* Expression-bodied members ([#638](https://github.com/OmniSharp/omnisharp-vscode/issues/638), [#403](https://github.com/OmniSharp/omnisharp-vscode/issues/403), [#679](https://github.com/OmniSharp/omnisharp-vscode/issues/679), [#249](https://github.com/OmniSharp/omnisharp-vscode/issues/249))
* Escaped keyword identifiers ([#614](https://github.com/OmniSharp/omnisharp-vscode/issues/614))
* Using directives and nested namespaces ([#282](https://github.com/OmniSharp/omnisharp-vscode/issues/282), [#381](https://github.com/OmniSharp/omnisharp-vscode/issues/381))
* Field and local variable type names ([#717](https://github.com/OmniSharp/omnisharp-vscode/issues/717), [#719](https://github.com/OmniSharp/omnisharp-vscode/issues/719))
* Multi-dimensional arrays in parameters ([#657](https://github.com/OmniSharp/omnisharp-vscode/issues/657))

#### Performance

* Improvements have been made in processing diagnostics (i.e. errors and warnings).
* Full solution diagnostics are no longer computed for large solutions (e.g. solutions with >1000 files across all projects). However, diagnostics are still computed for open files.

#### Other Improvements

* Multibyte characters are now properly encoded, resulting in proper display in tooltips and fixing crashes in the OmniSharp server. ([#4](https://github.com/OmniSharp/omnisharp-vscode/4), [#140](https://github.com/OmniSharp/omnisharp-vscode/140), [#427](https://github.com/OmniSharp/omnisharp-vscode/427))
* Will no longer attempt to install a CoreCLR flavor of OmniSharp on Ubuntu versions other than 14 and 16. ([#655](https://github.com/OmniSharp/omnisharp-vscode/issues/655))
* Opening a solution or csproj no longer results in '0 projects' displayed in the status bar. ([#723](https://github.com/OmniSharp/omnisharp-vscode/issues/723))

## 1.3.0 (July 20, 2016)

* Support for Unity and Mono development on macOS and Linux has been restored! This release brings back support for the Mono version of OmniSharp, which is used to provide *much* better support for .csproj/.sln projects. Please note that Mono version 4.0.1 or newer is required.
* Generation of tasks.json and launch.json files can now properly handle nested projects. [#170](https://github.com/OmniSharp/omnisharp-vscode/issues/170)
* New UI that makes it easy to select a process ID when attaching the debugger to another process. Note: If you have an existing launch.json file, you can re-generate it by deleting the file, closing your workspace in Visual Studio Code and opening it again. Or, you can open the launch.json file and change the `processId` value to `"${command:pickProcess}"`.
* Support for debugging in .cshtml files. To enable this, add a `sourceFileMap` entry to your launch.json with the following content: `"sourceFileMap": { "/Views": "${workspaceRoot}/Views" }`
* Support for conditional breakpoints
* New support for changing variable values in the debugger! To try this, just right-click on the variable name and select 'Set Value'. Note: To properly support this feature, we've changed the display of variable type names in the debugger to a shortened form. The full type name can be viewed by hovering over the name with the mouse.
* New configuration option to enable [stepping into properties and operators](https://github.com/OmniSharp/omnisharp-vscode/blob/release/debugger.md#stepping-into-properties-and-operators).
* Duplicate warnings and errors should no longer accumulate in Unity projects [#447](https://github.com/OmniSharp/omnisharp-vscode/issues/447)

## 1.2.0 (June 29, 2016)

* Adds debugger support for new Linux versions: Ubuntu 16.04, Fedora 23, openSUSE 13.2, and Oracle Linux 7.1
* Enhanced debug console output: module loads are now output, and there are launch.json options for controlling what is output
* Source file checksum support for breakpoints. This ensures that the debugger only sets breakpoints in code that exactly matches the open document.
* Support for editing the value of variables in the watch and locals window (requires VS Code 1.3)