### Branches

We do our work out of two branches:

* **[master](https://github.com/OmniSharp/omnisharp-vscode/tree/master)**: This is where normal development takes place. 99% of PRs should be submitted against master.
* **[release](https://github.com/OmniSharp/omnisharp-vscode/tree/release)**: This is where stabilization for official releases occurs. Prior to a release, we will merge master to release to prepare for stabilization.

There is one other branch that exists for legacy purposes:

* **[legacy-omnisharp-extension](https://github.com/OmniSharp/omnisharp-vscode/tree/legacy-omnisharp-extension)**: This is a branch from the last commit before the extension transitioned from the old version that shipped in the box with VS Code to the C# extension we have today. You shouldn't need to worry about this branch, but it is where the [Legacy C# Support extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.omnisharp) was built from.

### Releases

#### Marketplace Releases
* Marketplace releases will be built from the **release** branch and will usually increment the minor version number (e.g., 1.4.0, 1.5.0, etc.).
* Updates to Marketplace releases will increment the patch number (e.g. 1.5.1, 1.5.2).
* All Marketplace releases will be tagged with the version number in the form of v.X.X.X and included in our [GitHub Releases](https://github.com/OmniSharp/omnisharp-vscode/releases).

#### Pre-Releases

* Pre-releases will be build from the **master** branch and will be marked as a pre-release like so: vX.X.0-beta1.
* All pre-releases will also be tagged with the version number in the form of vX.X.X-betaX and included in our [GitHub Releases](https://github.com/OmniSharp/omnisharp-vscode/releases) marked as "pre-release".
* Pre-releases will never be released on the Marketplace.