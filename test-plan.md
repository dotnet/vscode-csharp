# Validating C# Extension for VS Code

### Requirements
- A supported [.NET SDK](https://dotnet.microsoft.com/download) available on the system path.

### Validation

#### Platforms
All the validations below should be performed on both Windows and at least one Unix platform (MacOS, Linux).  These can be done on x64 versions unless there are ARM specific changes to validate.

#### Opening projects
When you open a directory in VS Code, the C# extension should look for a .csproj, .sln, .slnx, or .slnf file in that directory and load it with the language server. If a .cs file is present and no project or solution file is present, IntelliSense should appear after a change is made to the file.
The "Output > C#" log should report project and solution loading information.

Project types to test:
* Standalone csproj
* Directory containing .sln, .slnx, or .slnf file that references csprojs--projects should be loaded
* .NET Core/.NET Standard csproj
* (Windows) Desktop .NET projects
* Unity projects
* A directory containing a .cs file without a csproj/sln/slnx. As stated above, intellisense should appear only when a change is made to the file.

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
* Messages in the "problems" window should appear only once per unique error

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
The Razor experience is available when you open a .cshtml file in a valid C# project.

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
* Typing `@ThisDoesNotExist` results in an error being created and squiggled in the .cshtml file.

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
The Blazor experience is available when you open a .razor file in a valid Blazor project.

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
* Typing `@SetParametersAsync()` prompts for signature help inside of the `()`.

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

##### HTML Document Color and Color Presentation
* Specifying a color name should display the color itself. Hovering over the color should display a color picker.
```HTML
<h1 style="background-color:blue"></h1>
```

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

#### Razor Project level Information
To verify the project level information for Razor do the following:
1. Install the latest preview of the .NET Core 3.0 SDK by going to https://github.com/dotnet/core-sdk and picking the appropriate platform specific installer from the Release/3.0.1XX column. The version should be 3.0.0-preview4-nnnnnn.
2. Verify the `obj/Debug/TheTFMOfTheProject` folder contains a `project.razor.json` file (once the project is restored)
3. Verify the `project.razor.json`'s `Configuration` section is not set to `null`.

Verify each of the test projects above's `project.razor.json` file (ASP.NET Core Razor and Blazor) looks something like the following:

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

#### Razor Options

##### Razor logging in the C# output window
Razor log output should be visible in the View --> Output --> C# window.
The output window log level can be set to any of the following values:
  * "Off" - No Razor log output will be shown.
  - "Info" - Limited messages will be shown, such as document lifecycle events.
  - "Debug" - Additional Razor debugging information will be shown.
  - "Trace" - The most verbose Razor logging will be shown.

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
