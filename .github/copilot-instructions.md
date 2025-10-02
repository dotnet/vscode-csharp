# Copilot Coding Agent Instructions for `vscode-csharp`

## Project Overview
- This is the official C# extension for Visual Studio Code, supporting C# development via OmniSharp and Roslyn-based language servers.
- The codebase is TypeScript/JavaScript, with some JSON and configuration files. It integrates with .NET components and external language servers.

## Architecture & Key Components
- **src/**: Main extension source. Key subfolders:
  - `lsptoolshost/`: Hosts LSP (Language Server Protocol) logic, including Copilot integration (`copilot/`), Roslyn, and Razor support.
  - `omnisharp/`: Protocols and logic for OmniSharp-based language server.
  - `razor/`: Razor language support and configuration.
- **Copilot Integration**:
  - `src/lsptoolshost/copilot/contextProviders.ts` and `relatedFilesProvider.ts` register C# context and related files providers for GitHub Copilot and Copilot Chat extensions.
  - The Roslyn Copilot language server is managed as a downloadable component (see `package.json` and `CONTRIBUTING.md`).

## Developer Workflows
- **Build**: `npm run compile` (or use VS Code build task)
- **Test**: `npm test` (runs Jest tests)
- **Package**: `npm run package` (creates VSIX)
- **Dependencies**: Use `gulp installDependencies` to fetch .NET/LS components
- **Debugging**: See `docs/debugger/` for advanced .NET debugging, including runtime and external library debugging.
- **Roslyn Copilot Language Server**: To update/test, see instructions in `CONTRIBUTING.md` (triggers pipeline, checks logs for install, etc.)

## Project Conventions & Patterns
- **TypeScript**: Follows strict linting (`.eslintrc.js`), including header/license blocks and camelCase filenames (except for interfaces and special files).
- **Component Downloads**: Language servers and debuggers are downloaded at runtime; see `package.json` for URLs and install logic.
- **Copilot Providers**: Use `registerCopilotContextProviders` and `registerCopilotRelatedFilesProvider` to extend Copilot context for C#.
- **Testing**: Tests are in `test/` and use Jest. Some grammars and language configs are embedded for Razor and XAML.

## Integration Points
- **GitHub Copilot**: Extension registers C# context and related files providers if Copilot/Copilot Chat extensions are present.
- **Roslyn Language Server**: Managed as a downloadable component, versioned in `package.json` and updated via pipeline.
- **OmniSharp**: Legacy support, also downloaded as a component.

## Examples
- To add a new Copilot context provider: see `src/lsptoolshost/copilot/contextProviders.ts`.
- To update Roslyn Copilot server: follow `CONTRIBUTING.md` > "Updating the Roslyn Copilot Language Server version".

## References
- [README.md](../README.md): User-facing overview and features
- [CONTRIBUTING.md](../CONTRIBUTING.md): Dev setup, packaging, and advanced workflows
- [package.json](../package.json): Component download logic, scripts
- [src/lsptoolshost/copilot/](../src/lsptoolshost/copilot/): Copilot integration logic

---
For any unclear or incomplete sections, please provide feedback to improve these instructions.