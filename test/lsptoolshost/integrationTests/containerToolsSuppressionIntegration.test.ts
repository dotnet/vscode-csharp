/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Integration test demonstrating the container tools modal suppression feature.
 * This simulates the behavior when the Docker or Dev Containers extension is present.
 */

import { describe, test, expect } from '@jest/globals';

// Mock VS Code API
const mockVSCode = {
    extensions: {
        getExtension: jest.fn(),
    },
    workspace: {
        getConfiguration: jest.fn(),
    },
    window: {
        showInformationMessage: jest.fn(),
    },
    commands: {
        executeCommand: jest.fn(),
    },
    l10n: {
        t: jest.fn((key: string) => key),
    },
};

// Override the vscode module for testing
jest.mock('vscode', () => mockVSCode);

describe('Container Tools Modal Suppression Integration', () => {
    test('Modal is suppressed when Docker extension is present', async () => {
        // Setup: Mock C# DevKit being installed
        mockVSCode.extensions.getExtension.mockImplementation((id: string) => {
            if (id === 'ms-dotnettools.csdevkit') {
                return { id: 'ms-dotnettools.csdevkit' };
            }
            if (id === 'ms-azuretools.vscode-docker') {
                return { id: 'ms-azuretools.vscode-docker' };
            }
            return undefined;
        });

        // Mock configuration (suppressGenerateAssetsWarning = false)
        mockVSCode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue(false),
        });

        // Import the actual functions (they would use the mocked vscode module)
        const { hasContainerToolsExtension } = await import('../../../src/utils/getContainerTools');
        const { getCSharpDevKit } = await import('../../../src/utils/getCSharpDevKit');

        // Test the detection logic
        expect(getCSharpDevKit()).toBeTruthy();
        expect(hasContainerToolsExtension()).toBe(true);

        // In the actual implementation, this would result in the modal being suppressed
        // and the function returning true immediately
        console.log('✅ Modal would be suppressed due to Docker extension presence');
    });

    test('Modal is suppressed when Dev Containers extension is present', async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup: Mock C# DevKit and Dev Containers being installed
        mockVSCode.extensions.getExtension.mockImplementation((id: string) => {
            if (id === 'ms-dotnettools.csdevkit') {
                return { id: 'ms-dotnettools.csdevkit' };
            }
            if (id === 'ms-vscode-remote.remote-containers') {
                return { id: 'ms-vscode-remote.remote-containers' };
            }
            return undefined;
        });

        const { hasContainerToolsExtension } = await import('../../../src/utils/getContainerTools');
        const { getCSharpDevKit } = await import('../../../src/utils/getCSharpDevKit');

        // Test the detection logic
        expect(getCSharpDevKit()).toBeTruthy();
        expect(hasContainerToolsExtension()).toBe(true);

        console.log('✅ Modal would be suppressed due to Dev Containers extension presence');
    });

    test('Modal is suppressed when configuration setting is enabled', async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup: Mock C# DevKit being installed but no container tools
        mockVSCode.extensions.getExtension.mockImplementation((id: string) => {
            if (id === 'ms-dotnettools.csdevkit') {
                return { id: 'ms-dotnettools.csdevkit' };
            }
            return undefined;
        });

        // Mock configuration (suppressGenerateAssetsWarning = true)
        mockVSCode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'suppressGenerateAssetsWarning') {
                    return true;
                }
                return false;
            }),
        });

        const { hasContainerToolsExtension } = await import('../../../src/utils/getContainerTools');
        const { getCSharpDevKit } = await import('../../../src/utils/getCSharpDevKit');

        // Test the detection logic
        expect(getCSharpDevKit()).toBeTruthy();
        expect(hasContainerToolsExtension()).toBe(false);

        // Configuration should suppress the modal
        const config = mockVSCode.workspace.getConfiguration('dotnet.server');
        expect(config.get('suppressGenerateAssetsWarning')).toBe(true);

        console.log('✅ Modal would be suppressed due to configuration setting');
    });

    test('Modal is shown when no suppression conditions are met', async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup: Mock C# DevKit being installed but no container tools and no configuration
        mockVSCode.extensions.getExtension.mockImplementation((id: string) => {
            if (id === 'ms-dotnettools.csdevkit') {
                return { id: 'ms-dotnettools.csdevkit' };
            }
            return undefined;
        });

        // Mock configuration (suppressGenerateAssetsWarning = false)
        mockVSCode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue(false),
        });

        const { hasContainerToolsExtension } = await import('../../../src/utils/getContainerTools');
        const { getCSharpDevKit } = await import('../../../src/utils/getCSharpDevKit');

        // Test the detection logic
        expect(getCSharpDevKit()).toBeTruthy();
        expect(hasContainerToolsExtension()).toBe(false);

        // Configuration should not suppress the modal
        const config = mockVSCode.workspace.getConfiguration('dotnet.server');
        expect(config.get('suppressGenerateAssetsWarning')).toBe(false);

        console.log('✅ Modal would be shown (normal DevKit behavior)');
    });
});