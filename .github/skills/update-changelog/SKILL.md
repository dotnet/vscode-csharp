---
name: update-changelog
description: Generate and curate CHANGELOG updates from recent pull requests, then create a ready-for-review PR. Use this when asked to update, refresh, or generate the development changelog.
---

# Update the CHANGELOG

Run the repository's existing changelog generator, curate its candidate entries
for user impact, and create a pull request containing only `CHANGELOG.md`.

## Input

- **Target branch** (optional): The branch whose changelog should be updated.
  Default to `main` unless the user specifies another branch.

## Prerequisites

1. Ensure `gh` is installed and authenticated:

   ```shell
   gh auth status
   ```

2. Use Node.js 24, matching the former changelog workflow.
3. Ensure `roslyn-tools` is available. If it is not installed, run:

   ```shell
   dotnet tool install -g Microsoft.RoslynTools --prerelease --source https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-tools/nuget/v3/index.json
   ```

4. Check `git status --short`. Do not overwrite unrelated work. In particular,
   stop and ask the user before continuing if `CHANGELOG.md` already has
   uncommitted changes.

## Generate candidate entries

1. Fetch the target branch and all release tags. The generator uses the newest
   tag matching the previous changelog version:

   ```shell
   git fetch origin <target-branch> --tags
   ```

2. Install the repository dependencies exactly as CI does:

   ```shell
   npm ci
   ```

3. Run the existing generator:

   ```shell
   npm run updateChangelog
   ```

If the generator cannot find a tag for the previous version, stop and report
the missing version. Do not guess a tag or manually choose an unrelated tag.

## Curate the generated entries

Inspect only the changes introduced by the generator:

```shell
git diff -- CHANGELOG.md
```

For every newly added pull request, use its description and diff to determine
whether it has clear impact on C# extension users:

```shell
gh pr view <number> --repo dotnet/vscode-csharp --json title,body,files,url
gh pr diff <number> --repo dotnet/vscode-csharp
```

Keep entries for user-visible features, fixes, diagnostics, editor behavior,
debugging, reliability, or performance. When the impact is ambiguous, omit the
entry.

Exclude:

- Component updates or insertions for Roslyn, Razor, OmniSharp, the debugger,
  the Copilot language server, and xamlTools. Their update process already
  curates relevant nested changelog notes.
- Infrastructure, build, pipeline, packaging, or dependency-maintenance work.
- Documentation-only or test-only changes.
- Internal refactoring without clear user-visible impact.

Reword retained entries as concise, factual, user-facing notes while preserving
the existing bullet and PR-link format. Do not change any pre-existing
changelog line, version header, component insertion note, or older section.

## Handle a no-op result

If the generator made no change, or no generated entries remain after
curation, restore `CHANGELOG.md` to its pre-generation state and do not create a
commit or pull request. Report that there were no relevant user-facing changes.

## Validate the update

Before committing:

1. Run `git diff --check`.
2. Confirm that `CHANGELOG.md` is the only modified file intended for the pull
   request.
3. Review the final diff once more to ensure all existing content is preserved.

## Create the pull request

Use a dedicated branch based on the target branch. If the current branch is
already dedicated to this update and based on the target branch, keep using it;
otherwise create a branch named `merge/update-<target-branch>-changelog`.

Commit only `CHANGELOG.md`:

```shell
git add CHANGELOG.md
git commit -m "Update <target-branch> CHANGELOG"
git push -u <push-remote> <work-branch>
```

Before creating a pull request, check for an existing open automated changelog
PR targeting the same branch. Do not create a duplicate; update the existing
PR when possible, or close it only after its replacement is ready.

Create a ready-for-review pull request with:

- **Repository:** `dotnet/vscode-csharp`
- **Base:** `<target-branch>`
- **Title:** `[automated] Update <target-branch> CHANGELOG`
- **Body:** Briefly summarize the retained user-facing changes.
- **Files:** Only `CHANGELOG.md`

Use the GitHub CLI and a body file:

```shell
gh pr create \
  --repo dotnet/vscode-csharp \
  --base <target-branch> \
  --title "[automated] Update <target-branch> CHANGELOG" \
  --body-file <pr-body-file>
```

When pushing from a fork, pass `--head <fork-owner>:<work-branch>`. Do not use
`--draft`; the changelog pull request should be ready for review.
