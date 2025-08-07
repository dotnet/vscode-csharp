/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { hasContainerToolsExtension, containerToolsExtensionIds } from '../../src/utils/getContainerTools';

// Mock vscode module
const mockGetExtension = jest.fn();
jest.mock('vscode', () => ({
    extensions: {
        getExtension: mockGetExtension,
    },
}));

describe('getContainerTools', () => {
    beforeEach(() => {
        mockGetExtension.mockReset();
    });

    test('hasContainerToolsExtension returns true when Docker extension is present', () => {
        // Mock Docker extension being present
        mockGetExtension.mockImplementation((id) => 
            id === 'ms-azuretools.vscode-docker' ? { id: 'ms-azuretools.vscode-docker' } : undefined
        );

        const result = hasContainerToolsExtension();
        expect(result).toBe(true);
    });

    test('hasContainerToolsExtension returns true when Dev Containers extension is present', () => {
        // Mock Dev Containers extension being present
        mockGetExtension.mockImplementation((id) => 
            id === 'ms-vscode-remote.remote-containers' ? { id: 'ms-vscode-remote.remote-containers' } : undefined
        );

        const result = hasContainerToolsExtension();
        expect(result).toBe(true);
    });

    test('hasContainerToolsExtension returns true when both extensions are present', () => {
        // Mock both extensions being present
        mockGetExtension.mockImplementation((id) => 
            containerToolsExtensionIds.includes(id) ? { id } : undefined
        );

        const result = hasContainerToolsExtension();
        expect(result).toBe(true);
    });

    test('hasContainerToolsExtension returns false when no container extensions are present', () => {
        // Mock no extensions being present
        mockGetExtension.mockImplementation(() => undefined);

        const result = hasContainerToolsExtension();
        expect(result).toBe(false);
    });

    test('hasContainerToolsExtension returns false when only unrelated extensions are present', () => {
        // Mock unrelated extension being present
        mockGetExtension.mockImplementation((id) => 
            id === 'unrelated-extension' ? { id: 'unrelated-extension' } : undefined
        );

        const result = hasContainerToolsExtension();
        expect(result).toBe(false);
    });

    test('containerToolsExtensionIds contains expected extension IDs', () => {
        expect(containerToolsExtensionIds).toContain('ms-azuretools.vscode-docker');
        expect(containerToolsExtensionIds).toContain('ms-vscode-remote.remote-containers');
        expect(containerToolsExtensionIds.length).toBe(2);
    });
});