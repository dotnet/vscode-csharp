## Summary
.NET Core introduces a new symbol file (PDB) format - portable PDBs. Unlike traditional PDBs which are Windows-only, portable PDBs can be created and read on all platforms. The new .NET debugger for Visual Studio Code only supports this new portable format. Portable PDBs can be generated both from [C# VS projects (.csproj)](#csproj) and [project.json projects](#net-cli-projects-projectjson), and they can be used regardless of what version of .NET the project targets.

More information about portable PDBs can be found on the [.NET team's GitHub page](https://github.com/dotnet/core/blob/master/Documentation/diagnostics/portable_pdb.md).

## How to Generate Portable PDBs
### .csproj 
With .NET Core "SDK"-style .csproj's, Portable PDBs are already enabled by default. 

For older .csproj files such as portable class libraries (PCLs) or the default in full .NET Framework applications, portable PDBs can be explicitly enabled by modifying the 'DebugType' property in the .csproj file to –

        <DebugType>portable</DebugType>

**NOTE**: For legacy reasons, the C# compiler option (and hence the name of the msbuild/project.json flags) to generate Windows PDBs is 'full'. However, this should NOT imply that Windows-only PDBs have more information than Portable PDBs. 

### project.json projects
If you still have legacy project.json-based projects, the following option can be used to force the use of portable PDBs. This is not necessary when building on OSX/Linux, but is on Windows --

    "buildOptions": {
        "debugType": "portable"
    },
