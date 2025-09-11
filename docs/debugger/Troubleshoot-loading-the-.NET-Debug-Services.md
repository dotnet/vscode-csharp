## Overview

This page provides instructions for troubleshooting the error "Failed to load the .NET Debugging Services" when using the VS Code C# Extension.

## Background

The C# Extension's debugger depends on the .NET Debugging services, which is a pair of native dynamic libraries which ship as part of the .NET Runtime --[lib]mscordbi.<dll|so|dylib> and [lib]mscordaccore.<dll|so|dylib>. These files must be in the folder of the .NET Runtime that is running in the process being debugged (example: '/usr/share/dotnet/shared/Microsoft.NETCore.App/6.0.424'). This error indicates that one or both of these native libraries couldn't be loaded into the debugger's process.

There are three reasons that we have seen this happen:
1. [.NET Debugging Services library file is missing](#error-cause-1-net-debugging-services-library-file-is-missing)
2. [Missing dependencies or other load failures](#error-cause-2-missing-dependencies)
3. [Mismatched processor architecture (macOS only)](#error-cause-3-mismatched-processor-architecture-macos-only)

### Error cause 1: .NET Debugging Services library file is missing

This error cause is if either of the .NET Debugging services native dynamic libraries ([lib]mscordbi.<dll|so|dylib> and [lib]mscordaccore.<dll|so|dylib>) don't exist. The most likely reasons for this would be if the target process has its own copy of the .NET Runtime, and that copy doesn't have these libraries. Note that if the target process is using the 'SingleFile' publishing (`dotnet publish ... -p:PublishSingleFile=true`) this will always happen -- debugging single file is not supported.

You can test for this condition by adding the following code to the start of your project and running your project using "Run->Run Without Debugging".

```C#
    string coreLibPath = typeof(object).Assembly.Location;
    if (string.IsNullOrEmpty(coreLibPath) || !System.IO.Path.IsPathFullyQualified(coreLibPath))
    {
        Console.WriteLine("CoreLib is not in a rooted path ('{0}')", coreLibPath);
    }
    else
    {
        string? dotnetRuntimeDirectory = System.IO.Path.GetDirectoryName(coreLibPath);
        if (dotnetRuntimeDirectory is null)
        {
            Console.WriteLine(".NET Runtime directory is null");
        }
        else
        {
            string? nativeLibraryPrefix = null, nativeLibraryExtension = null;
            if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows))
            {
                nativeLibraryPrefix = string.Empty;
                nativeLibraryExtension = ".dll";
            }
            else if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Linux))
            {
                nativeLibraryPrefix = "lib";
                nativeLibraryExtension = ".so";
            }
            else if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.OSX))
            {
                nativeLibraryPrefix = "lib";
                nativeLibraryExtension = ".so";
            }
            else
            {
                Console.WriteLine("Unsupported OS");
            }

            if (nativeLibraryPrefix is not null)
            {
                string dbiPath = System.IO.Path.Combine(dotnetRuntimeDirectory, nativeLibraryPrefix + "mscordbi" + nativeLibraryExtension);
                string dacPath = System.IO.Path.Combine(dotnetRuntimeDirectory, nativeLibraryPrefix + "mscordaccore" + nativeLibraryExtension);
                if (!System.IO.File.Exists(dbiPath))
                {
                    Console.WriteLine("DBI not found at '{0}'", dbiPath);
                }
                else if (!System.IO.File.Exists(dacPath))
                {
                    Console.WriteLine("DAC not found at '{0}'", dacPath);
                }
                else
                {
                    Console.WriteLine(".NET Debugging Services libries were found");
                }
            }
        }
    }
```

### Error cause 2: Missing dependencies

Another reason for this error is if the dynamic loader fails to load one of these native libraries. Exact troubleshooting steps will vary by platform, but here are the Linux troubleshooting steps as an example. 

First open a terminal and execute these steps:
```
# Step 1: go to the '.debugger' directory of the C# extension. 
# 'XXX' should be replaced with the actual version number.
cd ~/.vscode/extensions/ms-dotnettools.csharp-XXX.XXX.XXX-linux-x64/.debugger

# Step 2: export the 'LD_DEBUG' environment variable, which enables tracing
export LD_DEBUG=all

# Step 3, start the debugger as a server
./vsdbg-ui --server 2> ~/vsdbg-ui.log
```

Step 4: Go back to VS Code and configure the debugger to connect to vsdbg-ui in server mode:
* If you aren't using a launch.json file to debug, generate a launch.json file using the '.NET: Generate Assets for Build and Debug' command from the VS Code command palette (View->Command Palette).
* Open the launch.json file, find the active configuration, and add `"debugServer": 4711`.

Step 5: Start debugging. You should hopefully see debugging still fail with the same error, and now you have a large log file (~/vsdbg-ui.log in this example) of all the dynamic loader activity. You can then either try and understand the file yourself, or find the relevant section (search for 'mscordbi' for a good starting point) and share that log with the C# Extension debugger team.


### Error cause 3: Mismatched processor architecture (macOS only)

On ARM64 macOS, this error can be caused if the processor architecture of the debugger is different from the processor architecture of the target process. See [Debugging x64 processes on an arm64 computer
](Debugging-x64-processes-on-an-arm64-computer) for more information.