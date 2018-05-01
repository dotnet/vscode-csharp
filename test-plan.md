# Validating C# Extension for VS Code

#### Opening projects
When you open a directory in VS Code, the C# extension should look for a .csproj or .sln file in that directory and use "OmniSharp" to load it. 
If you look in "Output > Omnisharp Log" a bunch of information should be printed about what copy of MSBuild was used and what projects were load

Project types to test:
* Standalone csproj 
* Directory containing .sln file that references csprojs--projects should be loaded 
* .NET Core/.NET Standard csproj
* (Windows) Desktop .NET projects
* Unity projects

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

#### Omnisharp Options

  #### omnisharp.useMono (for Linux)
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
