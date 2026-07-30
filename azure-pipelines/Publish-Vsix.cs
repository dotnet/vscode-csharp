using System.Diagnostics;
using System.Runtime.CompilerServices;

var path = GetSourceDirectory();
var preRelease = false;
var dryRun = false;
var ci = false;

for (var index = 0; index < args.Length; index++)
{
    switch (args[index])
    {
        case "--path":
            if (++index >= args.Length)
            {
                throw new ArgumentException("--path requires a directory.");
            }

            path = Path.GetFullPath(args[index]);
            break;
        case "--pre-release":
            preRelease = true;
            break;
        case "--dry-run":
            dryRun = true;
            break;
        case "--ci":
            ci = true;
            break;
        default:
            throw new ArgumentException($"Unknown argument '{args[index]}'.");
    }
}

if (!Directory.Exists(path))
{
    throw new DirectoryNotFoundException($"Path '{path}' does not exist.");
}

if (!ci)
{
    RunCommand(GetCommandName("az"), ["account", "show"]);
}

var packages = Directory.GetFiles(path, "*.vsix", SearchOption.TopDirectoryOnly)
    .Order(StringComparer.OrdinalIgnoreCase)
    .Select(packagePath =>
    {
        var basePath = Path.Combine(
            Path.GetDirectoryName(packagePath)!,
            Path.GetFileNameWithoutExtension(packagePath));
        return (
            PackagePath: packagePath,
            ManifestPath: $"{basePath}.manifest",
            SignaturePath: $"{basePath}.signature.p7s");
    })
    .ToArray();

if (packages.Length == 0)
{
    Console.WriteLine($"No .vsix files found in '{path}'. Nothing to publish.");
    return 0;
}

foreach (var package in packages)
{
    if (!File.Exists(package.ManifestPath))
    {
        throw new FileNotFoundException(
            $"Manifest file not found for '{package.PackagePath}'.",
            package.ManifestPath);
    }

    if (!File.Exists(package.SignaturePath))
    {
        throw new FileNotFoundException(
            $"Signature file not found for '{package.PackagePath}'.",
            package.SignaturePath);
    }
}

var npx = GetCommandName("npx");
if (dryRun)
{
    RunVsce(["verify-pat", "--azure-credential", "ms-dotnettools"]);
}

foreach (var package in packages)
{
    var arguments = new List<string>
    {
        "publish",
        "--packagePath",
        package.PackagePath,
        "--manifestPath",
        package.ManifestPath,
        "--signaturePath",
        package.SignaturePath,
    };

    if (preRelease)
    {
        arguments.Add("--pre-release");
    }

    arguments.Add("--azure-credential");

    if (dryRun)
    {
        PrintCommand(npx, GetVsceArguments(arguments), "DryRun: ");
    }
    else
    {
        RunVsce(arguments);
    }
}

return 0;

void RunVsce(IReadOnlyList<string> arguments)
    => RunCommand(npx, GetVsceArguments(arguments));

static string[] GetVsceArguments(IReadOnlyList<string> arguments)
    => ["--yes", "--package", "@vscode/vsce", "vsce", .. arguments];

static void RunCommand(string fileName, IReadOnlyList<string> arguments)
{
    PrintCommand(fileName, arguments, "##[command]");

    // Disabling shell execution keeps stdout and stderr attached to the pipeline console.
    // In this mode Windows does not resolve extensionless command shims, so GetCommandName appends .cmd.
    var startInfo = new ProcessStartInfo(fileName)
    {
        UseShellExecute = false,
    };
    foreach (var argument in arguments)
    {
        startInfo.ArgumentList.Add(argument);
    }

    using var process = Process.Start(startInfo)
        ?? throw new InvalidOperationException($"Failed to start '{fileName}'.");
    process.WaitForExit();

    if (process.ExitCode != 0)
    {
        throw new InvalidOperationException(
            $"'{fileName}' exited with code {process.ExitCode}.");
    }
}

static void PrintCommand(
    string fileName,
    IReadOnlyList<string> arguments,
    string prefix)
{
    Console.WriteLine(
        $"{prefix}{fileName} {string.Join(' ', arguments.Select(argument => $"\"{argument}\""))}");
}

static string GetCommandName(string name)
    => OperatingSystem.IsWindows() ? $"{name}.cmd" : name;

static string GetSourceDirectory([CallerFilePath] string sourcePath = "")
    => Path.GetDirectoryName(sourcePath)!;
