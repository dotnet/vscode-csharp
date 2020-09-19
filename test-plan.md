# Validating C# Extension for VS Code

#### Opening projects
When you open a directory in VS Code, the C# extension should look for a .csproj, .sln, or .slnf file in that directory and use "OmniSharp" to load it. If a .cs file is present and no .csproj, .sln, or .slnf file are present, Omnisharp should start but the intellisense should only appear when a change is made to the file.
If you look in "Output > Omnisharp Log" a bunch of information should be printed about what copy of MSBuild was used and what projects were load

Project types to test:
* Standalone csproj
* Directory containing .sln or .slnf file that references csprojs--projects should be loaded
* .NET Core/.NET Standard csproj
* (Windows) Desktop .NET projects
* Unity projects
* A directory containing a .cs file without a csproj/sln. As stated above, intellisense should appear only when a change is made to the file.

The easist way to verify that a project was successfully loaded is to open a .cs file within it and verify that the references codelens indicator appears.

#### Specific projects to test opening (on all OSes):
* `dotnet new console` in a directory
* A more complex dotnet solution, eg. [1]
* A console app solution created in Visual Studio

#### Unity
* Follow the directions at https://code.visualstudio.com/docs/other/unity to configure VS Code with unity
* Try editing a project like https://github.com/staceyhaffner/SuperSpaceShooter

#### Intellisense
* The completion list in a file contains symbols defined in references and in the file
* If you write a documentation comment on a symbol, the completion list displays it

#### Signature Help
* Signature Help shows up in a method call after typing `(`
* Signature help shows documentation for methods and for parameters
* Parameter documentation is only shown for the currently active parameter

#### Quick Info
* Hovering over an identifier shows info and documentation

#### Formatting
* The "Format Document" command works
* Pressing enter inside a method body automatically indents the new line

#### Go To Definition
* F12 from callsites to definition
* Ctrl-Click
* Can go to metadata for symbols defined in metadata

#### Go To Implementation
* Ctrl-F12 on virtual member shows implementations

#### Find All References
* Shift-F12 on a symbol shows a reference list

### Reference highlighting
* Clicking on a symbol name should highlight other references to it in the same file

#### Colorization
* Appropriate colorization of keywords, literals, identifiers

#### Error squiggles
* Introducing an error should show a squiggle in the editor and an error message in the "problems" window
* Messages in the "problems" window should appear only once per unique error (see https://github.com/OmniSharp/omnisharp-vscode/issues/1830)

#### Quick Fixes
* Add using should be availble (does not currently suppport adding references)
* Generate variable/generate method should show up for missing members
* Remove unncessary usings should show up
* (this is not an exhaustive list)

#### Refactorings
* `Use expression body for methods` should be available
* `Rename file to match type` should correctly rename the file. The renamed file should be open after the refactoring
* (this is not an exhaustive list)

#### Code Lens - References
* References codelens appears on symbols and shows correct Find All References results

#### Code Lens - Unit Tests
* In unit tests projects, the "run test" and "debug test" codelens appears on test methods
  * Clicking runs or debugs the test and prints results to the console
  * Breakpoints in a unit test are hit if you "debug test"
* "Run All Tests" and "Debug All Tests" code lens buttons will appear on test classes
  * Click Run All or Debug All should run/debug all the tests in the class and print a summary
  * If you set breakpoints within multiple tests, you should hit each breakpoint as the tests are run

#### Symbol Finder
* Ctrl-T can find symbols by name when you type them
  * Symbols have appropriate glyphs

#### Rename
* Rename can rename symbols

#### File Watching
* In a project that uses globbing (.NET Core), use the VS Code file explorer to add a new file next to the csproj. Intellisense/sighelp/etc should be available in the new file
* Add a new file and reference a type in it from a different file. Deleting from disk the file containing the referenced type  should produce error messages

#### ASP.NET Core Razor
The Razor experience is available when you open a .cshtml file in a valid OmniSharp project.

To setup a test project to verify on you can do:
1. Install the latest preview of the .NET Core 3.0 SDK by going to https://github.com/dotnet/core-sdk and picking the appropriate platform specific installer from the Release/3.0.1XX column. The version should be 3.0.0-preview4-nnnnnn.
2. `dotnet new webapp`
3. Open `Pages/Index.cshtml`

##### C# Completion
* Typing `@DateTime.Now` and `@(DateTime.Now)` provides completions throughout typing.
* Completion is available for types that exist in the project (i.e. `Program`)
* Typing `@model DateTime` prompts for completion for the `model` symbol and the `DateTime` symbol.

##### C# Lightbulbs
* Typing `@{ var x = new HtmlString("sdf"); }`results in squiggles under `HtmlString`. Selecting `HtmlString` and pressing Ctrl+. results in a change suggestion to fully-qualify that type name as `Microsoft.AspNetCore.Html.HtmlString`. Hitting enter on that suggestion resolves the squiggles and changes the line.

##### C# Signature Help
* Typing `@Html.Raw()` prompts for signature help inside of the `()`.

##### C# Rename
* Renaming "someVariable" in `@{var someVariable = true;} @someVariable` results in both locations being changed.

##### C# Go to definition
* Performing go to definition on "@somevariable" `@{var someVariable = true;} @someVariable` brings you up to where it's declared

##### C# Go to implementation
* Performing go to implementation on "Foo" `@functions {interface Foo {} class Bar: Foo {}}` brings you to where "Bar" is declared

##### C# Find all references
* Performing find all references on "@someVariable" in `@{var someVariable = true;} @(someVariable) @someVariable` results in references to the other instance of someVariable

##### C# CodeLens
* Having the following results in a CodeLens entry above "Foo"
```razor
@functions {
  void Foo()
  {
  }
}

@Foo()
```
* Clicking on the CodeLens entry results in a find all references window that has an entry for `@Foo()`

##### C# Formatting
* Running the "Format Document" command with the below text results in correctly formatted C#,
```razor
@functions {
void Foo(){
}}
```

##### C# Diagnostics
* Typing `@ThisDoesNotExist` results in an error being created and squiggled in the .cshtml file. NOTE: This error squiggly will be misaligned due to known issues.

##### TagHelper Quick Info
* Typing `<environment></environment>` then hovering the mouse over the opening tag results in a window about that TagHelper that should read something like `EnvironmentTagHelper ITagHelper implementation targeting <environment> elements that conditionally renders content based on the current value of IHostingEnvironment.EnvironmentName...`.

##### TagHelper completion
Note that the pipe in the below examples indicates the cursor.
* Typing `<environment>` prompts you with HTML completion for the `environment` tag and on completion commit auto-completes the closing tag.
* Type `<cache |`, hit ctrl + space, search for `enabled`, commit the completion with a ` `. Ensure that it auto-completes the attribute to: `<cache enabled |`.
* Type `<cache |`, hit ctrl + space, search for `enabled`, commit the completion with a `=`. Ensure that it auto-completes the attribute to: `<cache enabled=|`.
* Type `<cache |`, hit ctrl + space, search for `vary-by`, commit the completion with a `=`. Ensure that it auto-completes the attribute to: `<cache vary-by=|`.
* Type `<cache |`, hit ctrl + space, search for `vary-by`, commit the completion with a `ENTER`. Ensure that it auto-completes the attribute to: `<cache vary-by|`.
* Type `<form |`, hit ctrl + space, search for `asp-route-...`, commit the completion. Ensure that it auto-completes the attribute to: `<form asp-route-|`.

##### TagHelper colorization
* Typing `<environment include="Development" notcolored="differently"></environment>` should change the color of `environment` and `include` (but not `notcolored`)to a blue-green color in the dark theme or a darker blue in the light theme. These colors should be visually distinct from html elements on the page while also not being the same color as an invalid element (`<notatag></notatag>` for an example).

##### Razor Diagnostics
* Typing `@{ <strong> }` results in errors. One error should be about the "strong" tag missing a closing tag.
* Fixing the error and typing `</strong>` i.e. `@{ <strong></strong> }` results in the diagnostic going away.

##### HTML Completion Documentation
* Typing `<a` results in the suggestion of the `a` tag with a description of the tag, and `MDN Reference`.

##### C# <text> tag
* Typing `@{ <te` results in the suggestion of the `text` tag with a description. Selecting the `text` suggestion and closing the tag with the `>` character results in the closing `</text>` being automatically added.

##### Known issues:
- Error squiggles may be misaligned due to known issues.

#### Blazor
The Blazor experience is available when you open a .razor file in a valid OmniSharp/Blazor project.

To setup a test project to verify on you can do:
1. Install the latest preview of the .NET Core 3.0 SDK by going to https://github.com/dotnet/core-sdk and picking the appropriate platform specific installer from the Release/3.0.1XX column. The version should be 3.0.0-preview4-nnnnnn.
2. `dotnet new blazorserverside`
3. Open `Pages/Index.razor`

#### Light bulbs
* Typing `@code { public int MyProperty { get; set; } }` and putting your cursor over `@code` provides you with a light bulb to "Extract block to code behind". Executing the light bulb results in the code block you wrote being removed and a new `*.razor.cs` file being created side-by-side.
* Typing `<SomeUnknownTag>` provides a light bulb to "Create component from tag". Executing the light bulb creates a new `SomeUnknokwnTag.razor` file.
* Updating a component (`Counter.razor`) to have a different namesapce (`@namespace SomeOtherNamespace`) results in attempted usages (`<Counter>`) providing light bulbs to "Fully Qualify" and to "@using SomeOtherNamespace".
  - Executing Fully Qualify results in `<SomeOtherNamespace.Counter>`
  - Executing "@using SomeOtherNamespace" adds a `@using SomeOtherNamespace` statement at the top of the file.

#### Go-to-definition
* Performing go to definition on a Component (i.e. `<Counter>`) brings you to the corresponding .razor file.

#### Rename
* Renaming a component (i.e. `<Counter>`) renames all usages of that component and renames the components file name.

##### C# Completion
* Typing `@DateTime.Now` and `@(DateTime.Now)` provides completions throughout typing.
* Completion is available for types that exist in the project (i.e. `Program`)
* Typing `@layout MainLayout` prompts for completion for the `layout` symbol and the `MainLayout` symbol.

##### C# Signature Help
* Typing `@SetParameters()` prompts for signature help inside of the `()`.

##### C# Rename
* Renaming "someVariable" in `@{var someVariable = true;} @someVariable` results in both locations being changed.

##### C# Go to definition
* Performing go to definition on "@somevariable" `@{var someVariable = true;} @someVariable` brings you up to where it's declared

##### C# Go to implementation
* Performing go to implementation on "Foo" `@functions {interface Foo {} class Bar: Foo {}}` brings you to where "Bar" is declared

##### C# Find all references
* Performing find all references on "@someVariable" in `@{var someVariable = true;} @(someVariable) @someVariable` results in references to the other instance of someVariable

##### C# CodeLens
* Having the following results in a CodeLens entry above "Foo"
```C#
@functions {
  void Foo()
  {
  }
}

@Foo()
```
* Clicking on the CodeLens entry results in a find all references window that has an entry for `@Foo()`

##### C# Diagnostics
* When no changes have been performed on `Pages/Index.cshtml`, there are 0 errors.
* Typing `@ThisDoesNotExist` results in an error being created and squiggled in the .cshtml file.

##### Debugging with blazorwasm debug adapter

**Note:** On a VS Code installation with no extensions, you should recieve an alert like the following:

> The Blazor WASM Debugging Extension is required to debug Blazor WASM apps in VS Code.

Press "Install Extension" before step 2 in each of the test scenarios below.

###### Standalone app

To set up a test project to verify on, create a new Blazor WebAssembly application using the dotnet CLI.

```
$ dotnet new blazorwasm -o DebugTestProject
```

1. Open the project in VS Code.
2. Press <key>F5</key> to start a new debugging session.
3. Select the "Blazor WebAssembly Debug" option.
4. Run the newly-created launch configuration.
5. Open Pages/Counter.razor and place a breakpoint in the `IncrementCount` method.
6. Navigate to the Counter page in the browser and click the counter button.
7. Verify that the breakpoint is hit.

###### Hosted app

Set up a test project to verify on by using the following dotnet CLI command. Note the `--hosted` flag.

```
$ dotnet new blazorwasm --hosted -o DebugHostedTestProject
```

1. Open the project in VS Code.
2. Press <key>F5</key> to start a new debugging session.
3. Ensure that the launch configuration contains the following properties, in addition to the defaults. Replace the target framework and target DLL fields as necessary.

```
{
  "hosted": true,
  "program": "${workspaceFolder}/Server/bin/Debug/<target-framework>/<target-dll>",
  "cwd": "${workspaceFolder}/Server"
}
```

4. Run the newly-crated launch configuration.
5. Open Pages/Counter.razor and place a breakpoint in the `IncrementCount` method.
6. Open the Controllers/WeatherForecastController.cs file and place a breakpoint in the GET handler.
7. Navigate to the Counter page in the browser and click the counter button.
8. Verify that the breakpoint in Counter.razor is hit.
9. Navigate to the weather forecast page. Verify that the breakpoint in WeatherForecastController.cs is hit.

###### Attaching to an existing running app

To set up a test project to verify on, create a new Blazor WebAssembly application using the dotnet CLI.

```
$ dotnet new blazorwasm -o DebugTestProject
```

Then run the project using the dotnet CLI.

```
$ cd DebugTestProject
$ dotnet run
```

1. Open the project in VS Code.
2. Create a new launch configuration with the following contents.

```
{
    "type": "blazorwasm",
    "request": "attach",
    "name": "Attach to Existing Blazor WebAssembly App"
}
```
3. Select the "Attach to Existing Blazor WebAssembly App" option and run the launch configuration.
5. Open Pages/Counter.razor and place a breakpoint in the `IncrementCount` method.
6. Navigate to the Counter page in the browser and click the counter button.
7. Verify that the breakpoint is hit.

##### Components
* Typing `<Counter>` prompts you with HTML completion for the `Counter` tag and on completion commit auto-completes the closing tag.
  - In the completion list that pops up ensure there's also a `YourProjectName.Pages.Counter` entry in the HTML completion list.
* Open `Counter.razor`, in the `@functions { ... }` block add:
  ```C#
  [Parameter]
  public int IncrementAmount { get; set; }
  ```
  - Save `Counter.razor` then wait 5 seconds.
  - Go back to `Index.razor` and type `<Counter |`, hit ctrl space, search for `IncrementAmount` attribute, commit the completion. Ensure that it auto-completes to `<Counter IncrementAmount="|"`
  - While inside the `IncrementAmount` attribute type `in`, hit ctrl + space, search for `int`, type `.`, search for `MaxValue` commit it, you should have `<Counter IncrementAmount="int.MaxValue"`
* Verify `_Imports.razor` works as expected:
  - Add a new Folder `Utilities` under the `/Pages` folder. Within that folder add a `Helper.razor` file.
  - Open the `_Imports.razor` under the `/Pages` folder. Add `@using YourProjectName.Pages.Utilities`
  - Go back to `Index.razor`. Typing `<Helper>` prompts you with HTML completion for the `Helper` tag.


##### Razor Diagnostics
* Typing `@{ <strong> }` results in errors. One error should be about the "strong" tag missing a closing tag.
* Fixing the error and typing `</strong>` i.e. `@{ <strong></strong> }` results in the diagnostic going away.

##### Known issues:
- Error squiggles may be misaligned due to known issues.

#### Legacy Razor
The Razor experience is degraded (but no errors) when you open a .cshtml file in a valid OmniSharp/Legacy Razor project. To setup a test project to verify on you can do:
1. Open Visual Studio
2. New Project
3. ASP.NET Web Application (.NET Framework)
4. Select MVC
5. OK
6. Open `Views/Home/Index.cshtml`

##### C# Completion / IntelliSense
* Typing `@DateTime.Now` does not result in any C# completion.
* Typing `@{ var x = DateTime.Now; }` does not result in any C# completion.
* Typing `@model` does not result in any Razor directive completion.

##### C# Diagnostics
* There are 0 .cshtml related errors on open.
* Typing `@ThisDoesNotExist` does not result in an error being created.

##### Html Completion
Verifying Html is needed to ensure the Razor experience is still partially enabled.
* Typing `<stron` results in Html completion with an entry for `strong`.
* Typing `<strong>` results in a corresponding `</strong>` being appended
* Hitting enter Typing `@{}` and then hitting enter inbetween the curly braces results in:
```
@{

}
```

#### Razor Project level Information
To verify the project level information for Razor do the following:
1. Install the latest preview of the .NET Core 3.0 SDK by going to https://github.com/dotnet/core-sdk and picking the appropriate platform specific installer from the Release/3.0.1XX column. The version should be 3.0.0-preview4-nnnnnn.
2. Verify the `obj/Debug/TheTFMOfTheProject` folder contains a `project.razor.json` file (once the project is restored)
3. Verify the `project.razor.json`'s `Configuration` section is not set to `null`.

Verify each of the test projects above's `project.razor.json` file (ASP.NET Core Razor, Blazor and Legacy Razor) looks something like the following:

##### ASP.NET Core Razor
```JSON
{
  "FilePath": "c:\\Users\\JohnDoe\\Projects\\RazorCoreTestApp\\RazorCoreTestApp.csproj",
  "Configuration": {
    "ConfigurationName": "MVC-3.0",
    "LanguageVersion": "3.0",
    "Extensions": [
      {
        "ExtensionName": "MVC-3.0"
      }
    ]
  },
  "ProjectWorkspaceState": {
    "TagHelpers": [ /* LOTS OF ENTRIES HERE */ ],
    "CSharpLanguageVersion": 703 // This may be different
  },
  "RootNamespace": "RazorCoreTestApp",
  "Documents": [ /* LOTS OF ENTRIES HERE */]
}
```

##### Blazor
```JSON
{
  "FilePath": "c:\\Users\\JohnDoe\\Projects\\BlazorTestApp\\BlazorTestApp.csproj",
  "Configuration": {
    "ConfigurationName": "MVC-3.0",
    "LanguageVersion": "MVC-3.0",
    "Extensions": [
      {
        "ExtensionName": "MVC-3.0"
      }
    ]
  },
  "ProjectWorkspaceState": {
    "TagHelpers": [ /* LOTS OF ENTRIES HERE */ ],
    "CSharpLanguageVersion": 703 // This may be different
  },
  "RootNamespace": "BlazorTestApp",
  "Documents": [ /* LOTS OF ENTRIES HERE */]
}
```

##### Legacy Razor
```JSON
{
  "ProjectFilePath": "c:\\Users\\JohnDoe\\Projects\\LegacyRazorTestApp\\LegacyRazorTestApp.csproj",
  "Configuration": {
    "ConfigurationName": "UnsupportedRazor",
    "LanguageVersion": "1.0",
    "Extensions": [
      {
        "ExtensionName": "UnsupportedRazorExtension"
      }
    ]
  },
  "ProjectWorkspaceState": {
    "TagHelpers": [],
    "CSharpLanguageVersion": 703 // This may be different
  },
  "RootNamespace": null,
  "Documents": []
}
```

#### Report a Razor issue
Perform the following in any of the above Razor projects.
* Run the `Report a Razor issue` command while `razor.trace` is set to `Off`. Ensure that you get a dialog stating that `razor.trace` must be set to `Verbose`.
* Run the `Report a Razor issue` command while `razor.trace` is set to `Verbose`. Follow the instructions, type a little bit in a .cshtml file when it's recording. Once you stop the recording ensure that the content copied to your clipboard has the following information:
  - Razor log output under the **Logs** section
  - The Razor document content under the **Workspace information** section
  - Projected CSharp document under the **Workspace information** section
  - Projected Html document under the **Workspace information** section
  - `dotnet --info` output under **Machine information** section
  - The table of extensions under the **Machine information** section

#### Razor Options

##### razor.disabled
This option can be set to `true` to disable the above described C# experiences.

##### razor.trace
This option should always be displayed in the View --> Output --> Razor Log window
This option can be set to any of the following values:
  * "Off" - Will launch Razor Language server with its log output set to 'Off'. The header in the Razor Log output window will be shown but no other content will be shown.
  * "Messages" - Will launch Razor Language server with its log output set to 'Messages'. Limited messages will be shown such as "Opening document xyz in project abc".
  * "Verbose" - Will launch Razor Language server with its log output set to 'Verbose'. All logging messages will be shown such as "123 - Synchronizing documentxyz currently ...."
Changing this option should result in a notification message at the bottom right of the window, prompting for a restart of the Razor Language Server.

#### OmniSharp Options

  #### omnisharp.useGlobalMono (for Linux/Mac)
  This option can be set to any of the following values:
  * "auto" - Will launch OmniSharp using mono if version>=5.2.0 is installed but will launch using the run script if that is not so.
  * "always" - Will launch OmniSharp using mono if version>=5.2.0 is installed and will throw an error otherwise.
  * "never" - Launches OmniSharp without using the global mono

  The value of OmniSharp path displayed in the OmniSharp log can be used to know if OmniSharp has launched using mono or not. If it is running using global mono, the path will end with "OmniSharp.exe" else the path will end with "run".
  For using this option, mono version greater than or equal to 5.2.0 must be installed. If that is not so, setting this option to true, should give an error.
  * If the option is not set, the OmniSharp path displayed in the "OmniSharp Log" should end with "run"
  * If the option is set, the OmniSharp path as mentioned above should end with "OmniSharp.exe"

  #### omnisharp.path
  Setting this path to any of the values as listed below, should start the OmniSharp server and display the correct OmniSharp path in the `OmniSharp Log`(View --> Output--> OmniSharp Log).
  * undefined - OmniSharp server must start using the copy of omnisharp shipped with the extension, that is, the OmniSharp path must be the extension path, followed by .omnisharp followed by the default omnisharp version as present in the package.json and the platform-specific executable.
  * Some absolute path - OmniSharp server must start using the local copy of OmniSharp pointed to by the path and the same must be displayed as the Omnisharp path. Example:C:\omnisharp-roslyn\artifacts\publish\OmniSharp.Stdio\win7-x64\OmniSharp.exe.
  * "<version>" - The specified version must be downloaded and installed (The status of download/install can be seen in the `C#` log). If the installation is successful, the server must start and the OmniSharp path must include the .omnisharp folder followed by the version name and the executable. Eg: If the version is `1.29.2-beta.60`, the path displayed on Windows should be `.omnisharp/1.29.2-beta.60/OmniSharp.exe`.
  * "latest" - The file containing the information about the latest CI build (https://roslynomnisharp.blob.core.windows.net/releases/versioninfo.txt), must be downloaded and accordingly the latest CI build from the "master" branch of omnisharp-roslyn should be downloaded and installed. If the installation is successful, the server must start and the OmniSharp path must include the .omnisharp folder followed by the version name and the executable. Eg: If the latest version is `1.29.2-beta.62`, the path displayed on Windows should be `.omnisharp/1.29.2-beta.62/OmniSharp.exe`.
  * All the above configurations should work, with and without setting the useMono option on Linux
  * The above behavior should be exhibited when a new vscode window is opened, as well as if the setting is modified and a "Restart OmniSharp"(Ctrl+Shift+P --> OmniSharp: Restart OmniSharp) is performed.

####  Status Bar Item
The status bar item(s) must appear on the left side of the VS Code's status bar
* When the extension is setting up the dependencies, the status bar item should show "Downloading packages"/"Installing packages".
* Once the server has started, there should be two status bar items:
  * OmniSharp status Bar item - It should show a green flame (indicating that the OmniSharp server is running) and clicking on it should show the OmniSharp log channel
  * Project status bar item  - It should show and a folder icon and the name of the currently selected project/solution. Clicking on this element should show a command palette menu to select other projects/solutions in the workspace.

[1] For example,
```
mkdir project
mkdir test
dotnet new console -o project
dotnet new xunit -o test
dotnet add test\test.csproj reference project\project.csproj
dotnet new solution -n solution
dotnet sln solution.sln add test\test.csproj project\project.csproj
```
