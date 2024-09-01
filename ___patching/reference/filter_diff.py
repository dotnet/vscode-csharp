import json

# curl -s https://api.github.com/repos/dotnet/vscode-csharp/compare/main...muhammadsammy:free-vscode-csharp:master > comparison.json

# Load the comparison data from the file
with open('comparison.json', 'r') as file:
    comparison_data = json.load(file)

# Filter out changes in node_modules
filtered_files = [
    file for file in comparison_data['files']
    if 'node_modules' not in file['filename']
]

def extract_relevant_changes(diff):
    """
    Extracts only the lines that have been added or removed from the diff.
    """
    relevant_changes = []
    for line in diff.splitlines():
        if line.startswith('+') and not line.startswith('+++'):
            relevant_changes.append(line)
        elif line.startswith('-') and not line.startswith('---'):
            relevant_changes.append(line)
    return relevant_changes

# Extract the relevant changes from the filtered files
for file in filtered_files:
    if 'patch' in file:
        changes = extract_relevant_changes(file['patch'])
        if changes:
            print(f"Changes in {file['filename']}:")
            for change in changes:
                print(change)
            print("")
