---
name: Update CHANGELOG
on:
  workflow_dispatch:
  schedule:
    # Runs every Thursday at 9 PM PST / 10 PM PDT (5 AM UTC Friday)
    - cron: '0 5 * * 5'
permissions:
  contents: read
  pull-requests: read
  copilot-requests: write
env:
  # Prompt expressions cannot reference github.ref_name directly.
  CHANGELOG_BRANCH: ${{ github.ref_name }}
checkout:
  # The generator needs release tags and their history.
  fetch-depth: 0
network:
  # PR access uses gh-proxy; general network access is unnecessary.
  allowed: []
tools:
  github:
    mode: gh-proxy
    toolsets: [pull_requests, repos]
  bash:
    - 'git diff:*'
    - 'git show:*'
safe-outputs:
  create-pull-request:
    title-prefix: '[automated] Update '
    # Keep the old action's ready-for-review PR behavior.
    draft: false
    allowed-files: [CHANGELOG.md]
    # Changelog updates must be PRs, not issue fallbacks.
    fallback-as-issue: false
    close-older-pull-requests: true
    # Manual release-branch runs must not supersede default-branch PRs.
    close-older-key: update-changelog-${{ github.ref_name }}
steps:
  - name: Install roslyn-tools
    run: dotnet tool install -g Microsoft.RoslynTools --prerelease --source https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-tools/nuget/v3/index.json
  - name: Install NodeJS
    uses: actions/setup-node@v7
    with:
      node-version: '24.x'
  - name: Generate changelog candidates
    run: |
      npm ci
      npm run updateChangelog
---

# Curate the changelog

The existing generator has added candidate PR entries to `CHANGELOG.md`.
Inspect `git diff HEAD -- CHANGELOG.md` and use PR descriptions and diffs
(`gh pr view --json ...` and `gh pr diff`) to retain only changes with clear
impact on C# extension users. Omit entries whose user impact is unclear.

Exclude component updates and insertions entirely, including Roslyn, Razor,
OmniSharp, debugger, Copilot language server, and xamlTools updates: their
insertion process already curates relevant notes.

Reword retained additions as concise, factual, user-facing notes using the
existing bullet and PR-link format. Preserve every pre-existing line, including
component insertion notes, version headers, and older sections.

If no relevant additions remain, restore the original changelog, emit `noop`,
and leave existing PRs unchanged.

Otherwise create a local branch, commit the curated additions, and use
`create_pull_request` with the title `${{ env.CHANGELOG_BRANCH }} CHANGELOG`.
Briefly explain the retained user-facing changes in the PR body.
