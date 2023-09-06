# This script updates our *.tmLanguage.json files from the latest copies in the VS Code repo.
#
# We pull these files from the VS Code repo's main branch, and VS Code in turn pulls them from
# various repos, but rather than pull directly from them, by using the VS Code repo we get the
# benefit of their testing, and their finding the best sources for the various languages.

# Need to run this first: Install-Module -Name PowerShellForGitHub
Import-Module -Name PowerShellForGitHub

function DownloadTmLanguageJson {
    param (
        [string]$sha,
        [string]$lang,
        [string]$filename
    )

    if ($filename -eq "") {
        $filename = "$lang.tmLanguage.json"
    }

    # tmLanguage.json
    $url = "https://raw.githubusercontent.com/microsoft/vscode/$sha/extensions/$lang/syntaxes/$filename"
    Write-Host "Downloading $url"

    $content = Invoke-WebRequest -Uri $url

    # Copy to grammar tests
    $content.content | Out-File -FilePath "$fileName" -Encoding ascii
}

# Find the current main branch SHA to download from
$branch = Get-GitHubBranch -OwnerName "microsoft" -RepositoryName "vscode" -BranchName "main"
$sha = $branch.commit.sha
Write-Host "VS Code main branch SHA: $sha"

DownloadTmLanguageJson -sha $sha -lang "csharp"
DownloadTmLanguageJson -sha $sha -lang "css"
DownloadTmLanguageJson -sha $sha -lang "html"
# GitHub URLs are case sensetive, and JavaScript is special
DownloadTmLanguageJson -sha $sha -lang "javascript" -filename "JavaScript.tmLanguage.json"