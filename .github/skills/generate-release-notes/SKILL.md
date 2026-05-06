---
name: generate-release-notes
description: Generate release notes for a new stable release of the C# extension by gathering prerelease CHANGELOG entries and writing them in VS Code release notes style. Use this when asked to generate, draft, or write release notes.
---

# Generate Release Notes

This skill describes how to generate release notes for a stable release of the C# VS Code extension.

## Background

### Versioning Scheme

The extension uses a tiered versioning scheme: `2.<minor>.x`.

- **Release versions** have a minor version ending in `0` (e.g., `2.120.x`, `2.130.x`).
- **Prerelease versions** have a minor version that does **not** end in `0` (e.g., `2.121.x`, `2.122.x`, ..., `2.129.x`).
- When a new stable release is created, the minor version **increments to the next ten** (e.g., `2.120` → `2.130`).

So for a release at version `2.130`, the prerelease entries are `2.121.x` through `2.129.x`. For `2.140`, they are `2.131.x` through `2.139.x`.

### Branch Structure

- `main` — Active development; CHANGELOG here contains the latest prerelease entries.
- `prerelease` — Published prerelease builds; CHANGELOG here is the **canonical source** for prerelease entries.
- `release` — Published stable builds.

**Always use the CHANGELOG from the `prerelease` branch** as the source of truth for changes since the last release.

## Input Required

- **Target release version** (optional): The stable version being released (e.g., `2.130`). If not provided, determine it from the current `version.json` on `main` by rounding up the minor version to the next ten.

## Process

### Step 1: Determine the version range

1. Identify the **target release version**. If not given, read `version.json` on `main` to get the current minor version, and round up to the next ten (e.g., if current is `2.131`, the next release is `2.140`).
2. Calculate the **previous release version** by subtracting 10 from the target minor (e.g., target `2.140` → previous `2.130`).
3. The prerelease sections to gather are all minor versions **after** the previous release and **before** the target release. For example, for target `2.140`: sections `2.131.x`, `2.132.x`, ..., `2.139.x`.

### Step 2: Fetch the CHANGELOG from prerelease and main branches

The prerelease entries may be spread across the `prerelease` and `main` branches. The `prerelease` branch is the canonical source, but `main` may contain newer entries that haven't been published to prerelease yet.

Fetch both branches and retrieve their CHANGELOGs:

```bash
git fetch origin prerelease main
git show origin/prerelease:CHANGELOG.md
git show origin/main:CHANGELOG.md
```

Extract sections for the prerelease versions identified in Step 1 from **both** branches, deduplicating any sections that appear in both. Prefer the `prerelease` branch version if a section appears in both.

### Step 3: Follow PR and issue links to gather details

For each entry in the extracted CHANGELOG sections:

1. **Follow the PR link** (e.g., `https://github.com/dotnet/vscode-csharp/pull/8954`) to read the PR description for additional context about the change.
2. **If the PR has a linked issue**, follow that link too to understand the user-facing problem being solved.

This additional context is critical for writing meaningful, user-facing release notes rather than just echoing commit messages.

### Step 4: Generate the release notes

Write a markdown document in the style of VS Code release notes (see https://code.visualstudio.com/updates/v1_106 for an example of the format and tone).

#### Content rules

Apply these rules strictly when deciding what to include and how to organize it:

- **Do not mention version bumps directly** — instead, describe the improvements and fixes they bring.
- **PRs from `dotnet/razor`** should only appear under a **Razor** section.
- **`xamlTools` fixes** should only appear under a **MAUI** section.
- **Do not mention** documentation-only changes.
- **Do not mention** infrastructure-only changes (CI/CD, pipeline, packaging).
- **Do not mention** unit test or integration test changes.
- **Do not mention** the specific prerelease version a change was made in.
- **Do not mention** these instructions in the output document.

#### Organizing sections

Group changes into logical sections. The sections below are listed in the **required order** — always present them in this order (use only those that have relevant entries):

1. **C# Language Support** — General C# language features, completions, diagnostics, refactorings, code fixes, etc. Changes from `dotnet/roslyn` that are not Razor-specific go here.
2. **Performance** — Notable performance improvements from any component.
3. **Razor** — All changes from `dotnet/razor` PRs and Razor-related features.
4. **Debugging** — Debugger improvements and fixes.
5. **MAUI** — Changes related to `xamlTools` or MAUI features.
6. **Editor Experience** — UX improvements in the extension itself (project context, settings, commands, etc.).

Within each section, lead with new features and improvements, then list fixes.

#### Writing style

- Write in a user-facing tone: describe **what changed for the user**, not internal implementation details.
- Be concise but informative. Each item should be 1-2 sentences.
- Where a change fixes a user-visible bug, describe the symptom that was fixed.
- Where a change adds a new feature, describe what users can now do.
- Use present tense (e.g., "The extension now supports..." not "Added support for...").
- Link to the relevant PR from `dotnet/vscode-csharp` for each item (not the upstream Roslyn/Razor PR).

### Step 5: Create a PR against the release branch

The release notes are delivered as a PR that modifies `CHANGELOG.md` on the `release` branch. This inserts the generated notes as a new version section at the top of the changelog.

#### Prerequisites: Install and authenticate the GitHub CLI

If `gh` is not installed, install it first:

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux (Debian/Ubuntu)
sudo apt install gh
```

Verify installation and authenticate if needed:

```bash
gh --version
gh auth status || gh auth login
```

#### Create the branch, commit, and PR

1. **Stash any local changes** to avoid conflicts:

   ```bash
   git stash --include-untracked
   ```

2. **Create a new branch** directly from the remote `release` branch:

   ```bash
   git fetch origin release
   git checkout -b changelog/v2.<VERSION> origin/release
   ```

   If a conflicting branch name exists (e.g., a stale `changelog` branch), delete it first with `git branch -D <conflicting-branch>`.

3. **Edit `CHANGELOG.md`** — insert the generated release notes as a new `# 2.<VERSION>.x` section immediately after the `## Known Issues` block and before the previous release section. The format should be:

   ```markdown
   # 2.<VERSION>.x

   <generated release notes content>

   # 2.<PREVIOUS_VERSION>.x
   ```

4. **Commit and push**:

   ```bash
   git add CHANGELOG.md
   git commit -m "Release notes for version 2.<VERSION>.x"
   git push -u origin changelog/v2.<VERSION>
   ```

5. **Create the PR** targeting the `release` branch. Write the PR body to a temp file first to avoid shell quoting issues with markdown content:

   ```bash
   # Write PR body to a temp file (markdown with backticks, angle brackets, etc.)
   cat > /tmp/pr-body.md << 'PRBODY'
   <PR body content here>
   PRBODY

   gh pr create \
     --repo dotnet/vscode-csharp \
     --base release \
     --title "Release notes for version 2.<VERSION>.x" \
     --body-file /tmp/pr-body.md

   rm /tmp/pr-body.md
   ```

   > **Important**: Use `--body-file` instead of `--body` because the PR body contains markdown with backticks, angle brackets, and other characters that break shell quoting. Also use `--repo dotnet/vscode-csharp` to ensure the PR is created on the correct repository even if the git remote uses an older URL.

6. **Return to the original branch** and restore stashed changes:

   ```bash
   git checkout main
   git stash pop
   ```

#### PR conventions

- **Target branch**: `release` (not `main`)
- **Title**: `Release notes for version 2.<VERSION>.x`
- **Body**: A brief summary of the key themes (e.g., "This update includes improvements to reliability, diagnostics tooling, language server performance, and Razor editing."). Always use `--body-file` to avoid shell quoting issues.
- **Only `CHANGELOG.md` should be modified** in the PR.

## Example

For a release at version `2.130`, using CHANGELOG sections `2.121.x`, `2.122.x`, and `2.123.x`, the PR would insert a section like this into `CHANGELOG.md` on the `release` branch:

```markdown
# 2.130.x

This update brings significant improvements to reliability, diagnostics tooling,
language server performance, and Razor editing.

## Reliability

### Improved error reporting when the language server encounters an error

The experience when the language server crashes has been significantly improved.
Now, a single consolidated notification is shown with a "Report Issue" button
that opens the issue reporter with logs pre-filled. Server crashes can also
trigger an automatic restart. ([vscode-csharp#8982](https://github.com/dotnet/vscode-csharp/pull/8982))

## Performance

### Balanced source generator execution (default)

Source generator execution now defaults to **Balanced** mode, running only on
file save, build, or explicit command rather than every keystroke. Use the
`dotnet.server.sourceGeneratorExecution` setting to switch back to `Automatic`
if needed. ([vscode-csharp#8970](https://github.com/dotnet/vscode-csharp/pull/8970))

## Razor

### Formatting fixes

- Fixed formatting of multiline `@if` statements, ternary expressions, and
  wrapped CSS. ([razor#12786](https://github.com/dotnet/razor/pull/12786))
- Fixed indentation after complete tags. ([razor#12784](https://github.com/dotnet/razor/pull/12784))
```

## Notes

- This skill works best with a model that can follow links and synthesize information from PRs and issues (e.g., Claude Opus).
- If the CHANGELOG on the prerelease branch is not yet up to date, the agent should note this and work with whatever is available.
- The agent should use `fetch_webpage` to follow GitHub PR links and gather details.
- If `gh` authentication fails or the user doesn't have push access, fall back to creating the branch locally and instruct the user to open the PR manually.
