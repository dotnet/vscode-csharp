## Background
On Linux, .NET Core depends on libicu for data about locales and international settings. There is a special [Globalization Invariant Mode](https://github.com/dotnet/corefx/blob/master/Documentation/architecture/globalization-invariant-mode.md) that can be enabled to remove this dependency, but Invariant Mode isn't enabled by default. When Invariant Mode is NOT enabled, and when a compatible libicu cannot be found, the process running .NET Core (probably the debugger if you are reading this article) will abruptly exit.

To enable invariant mode, add the following environment variable: `export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1`.

This page provides information to verify that the libicu installed on your system is compatible with .NET Core.

## Testing

1. Run: `dotnet new console -f net5.0 -o CultureInfoTest` to create a new console app
2. `cd CultureInfoTest`
3. Replace Program.cs with the below code
4. `dotnet run`

New program.cs:
```C#
using System;

namespace CultureInfoTest
{
    class Program
    {
        static void Main(string[] args)
        {
            // Test if we can successfully create a culture info
            new System.Globalization.CultureInfo("en-US");

            Console.WriteLine("Test successful.");
        }
    }
}
```

