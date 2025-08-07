# Container Tools Modal Suppression

This implementation provides a solution to suppress the modal toast that suggests against using the ".NET: Generate Assets for Build and Debug" command when the Container Tools extension is present.

## Problem Statement

When C# Dev Kit is installed, there is a modal popup that recommends against using the ".NET: Generate Assets for Build and Debug" command. However, containerized debugging relies on those static tasks and cannot use the dynamic tasks from the C# Dev Kit extension, causing user confusion.

## Solution

The implementation provides two ways to suppress the modal:

### 1. Automatic Suppression (Container Tools Detection)

The modal is automatically suppressed when any of the following container tools extensions are detected:

- `ms-azuretools.vscode-docker` (Docker extension)
- `ms-vscode-remote.remote-containers` (Dev Containers extension)

### 2. Manual Configuration

Users can manually suppress the modal by setting the configuration option:

```json
{
  "dotnet.server.suppressGenerateAssetsWarning": true
}
```

## Implementation Details

### Files Added/Modified

1. **`src/utils/getContainerTools.ts`** - New utility function to detect container tools extensions
2. **`src/lsptoolshost/debugger/debugger.ts`** - Modified to check for container tools and configuration
3. **`package.json`** - Added new configuration option
4. **`package.nls.json`** - Added localization string for the configuration
5. **Test files** - Comprehensive unit and integration tests

### Behavior

| Scenario | DevKit Installed | Container Tools | Config Setting | Modal Behavior |
|----------|------------------|-----------------|----------------|----------------|
| Normal DevKit | ✅ | ❌ | ❌ | Modal shown (existing behavior) |
| Container Debug | ✅ | ✅ | ❌ | **Modal suppressed** |
| Manual Config | ✅ | ❌ | ✅ | **Modal suppressed** |
| No DevKit | ❌ | ❌/✅ | ❌/✅ | No modal (existing behavior) |

## Key Benefits

1. **Eliminates user confusion** - Container debugging scenarios work seamlessly
2. **Maintains backward compatibility** - No change to existing behavior when container tools are not present
3. **Provides flexibility** - Manual configuration option for edge cases
4. **Minimal implementation** - Only 27 lines of new code in the core implementation
5. **Well tested** - Comprehensive unit and integration tests

## Testing

The implementation includes comprehensive tests:

- Unit tests for container tools detection logic
- Integration tests for the complete flow
- Mock scenarios covering all edge cases

Run the demo to see the behavior:

```bash
node /tmp/container-tools-demo.js
```

## Future Extensibility

The `containerToolsExtensionIds` array can be easily extended to support additional container-related extensions if needed.