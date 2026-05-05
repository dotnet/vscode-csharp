---
name: update-dotnet-skills-in-box
description: >-
  Syncs the bundled Copilot skills from the upstream dotnet/skills GitHub repo,
  updates skills.lock.json with the new commit SHA and timestamp, and stages all
  changed files ready for a PR. Use when asked to update the in-box skills,
  bump the skills version, or pull the latest skill content from dotnet/skills.
---

# Update Dotnet Skills In-Box

This skill describes how to update the bundled Copilot agent skills shipped with
the C# extension. The skill files live in `src/lsptoolshost/copilot/skills/` and
are sourced from the [`dotnet/skills`](https://github.com/dotnet/skills) GitHub
repository. A lock file (`skills.lock.json`) records the exact upstream commit
SHA that was synced so reviewers can verify the version in use.

## What Gets Updated

- `src/lsptoolshost/copilot/skills/<skill-name>/SKILL.md` — one per skill
- `src/lsptoolshost/copilot/skills/<skill-name>/references/*.md` — reference docs
- `src/lsptoolshost/copilot/skills/skills.lock.json` — per-skill version lock file

The five bundled skills are:

| Skill | Source path in dotnet/skills |
|-------|------------------------------|
| `csharp-scripts` | `plugins/dotnet/skills/csharp-scripts` |
| `analyzing-dotnet-performance` | `plugins/dotnet-diag/skills/analyzing-dotnet-performance` |
| `dotnet-trace-collect` | `plugins/dotnet-diag/skills/dotnet-trace-collect` |
| `dump-collect` | `plugins/dotnet-diag/skills/dump-collect` |
| `microbenchmarking` | `plugins/dotnet-diag/skills/microbenchmarking` |

## Steps

### 1. Check the current versions

Read the existing lock file to see what commit each skill is currently at:

```powershell
Get-Content src/lsptoolshost/copilot/skills/skills.lock.json
```

Note each skill's `commitSha` — you will compare these to the new SHAs after updating.

### 2. Copy the updated files

For each skill you want to update, download the files from the upstream repo and
copy them into the corresponding `src/lsptoolshost/copilot/skills/<name>/`
directory, replacing existing files.

The raw file URLs follow this pattern:
```
https://raw.githubusercontent.com/dotnet/skills/main/<sourcePath>/SKILL.md
https://raw.githubusercontent.com/dotnet/skills/main/<sourcePath>/references/<file>
```

Refer to the skill table above for each skill's `sourcePath`.

### 3. Update skills.lock.json

For each skill you updated, find its latest commit SHA using the GitHub API:

```powershell
(Invoke-RestMethod 'https://api.github.com/repos/dotnet/skills/commits?path=<sourcePath>&per_page=1')[0].sha
```

Then update the corresponding `commitSha` field in
`src/lsptoolshost/copilot/skills/skills.lock.json` and set `syncedAt` to the
current UTC timestamp (ISO 8601 format, e.g. `2026-05-05T21:20:29.989Z`).

The lock file format is:

```json
{
  "upstreamRepo": "dotnet/skills",
  "upstreamRef": "main",
  "syncedAt": "<timestamp>",
  "skills": {
    "<skill-name>": {
      "sourcePath": "<path-in-dotnet/skills-repo>",
      "commitSha": "<latest-commit-sha-for-this-skill-directory>"
    }
  }
}
```

### 4. Review the diff

```powershell
git diff src/lsptoolshost/copilot/skills/
```

Review the changes to ensure only expected content was updated. If the diff is
empty, the skills were already at the latest version — no PR is needed.

### 5. Stage and commit

```
git add src/lsptoolshost/copilot/skills/
git commit -m "Update bundled Copilot skills from dotnet/skills"
```

### 6. Open a PR

Push the branch and open a PR targeting `main`. Use this PR description template:

```
## Summary

Updates the bundled Copilot agent skills from the upstream `dotnet/skills` repository.

**Previous commit:** `<old-sha>`
**New commit:** `<new-sha>`

Compare: https://github.com/dotnet/skills/compare/<old-sha>...<new-sha>

## Skills updated
- `csharp-scripts`
- `analyzing-dotnet-performance`
- `dotnet-trace-collect`
- `dump-collect`
- `microbenchmarking`
```

## Adding or Removing a Skill

To add a new skill or remove an existing one, two files must be updated together:

1. **`tasks/skills/syncBundledSkills.ts`** — add or remove an entry in the
   `bundledSkills` array. Each entry needs `name`, `sourcePath` (path in the
   upstream repo), and `references` (list of filenames under `references/`).

2. **`package.json`** — add or remove the corresponding entry in
   `contributes.chatSkills`. The `path` must point to
   `./src/lsptoolshost/copilot/skills/<name>/SKILL.md`.

After editing both files, run `npm run syncBundledSkills` to download the new
skill and regenerate the lock file.
