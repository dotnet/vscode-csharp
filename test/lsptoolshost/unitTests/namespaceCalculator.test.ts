/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import * as vscode from 'vscode';
import { calculateNamespace, extractCurrentNamespace } from '../../../src/lsptoolshost/refactoring/namespaceCalculator';

describe('Namespace Calculator', () => {
    describe('extractCurrentNamespace', () => {
        test('should extract file-scoped namespace', () => {
            const code = `using System;

namespace MyApp.Services;

public class MyService
{
}`;
            const result = extractCurrentNamespace(code);

            expect(result).toBeDefined();
            expect(result?.namespace).toBe('MyApp.Services');
            expect(result?.isFileScoped).toBe(true);
        });

        test('should extract block-scoped namespace', () => {
            const code = `using System;

namespace MyApp.Controllers
{
    public class HomeController
    {
    }
}`;
            const result = extractCurrentNamespace(code);

            expect(result).toBeDefined();
            expect(result?.namespace).toBe('MyApp.Controllers');
            expect(result?.isFileScoped).toBe(false);
        });

        test('should extract nested namespace', () => {
            const code = `namespace MyApp.Domain.Models
{
    public class User
    {
    }
}`;
            const result = extractCurrentNamespace(code);

            expect(result).toBeDefined();
            expect(result?.namespace).toBe('MyApp.Domain.Models');
        });

        test('should return null for file without namespace', () => {
            const code = `using System;

public class GlobalClass
{
}`;
            const result = extractCurrentNamespace(code);

            expect(result).toBeNull();
        });

        test('should ignore namespace in comments', () => {
            const code = `// namespace MyApp.Fake;
/* namespace MyApp.AnotherFake { */

namespace MyApp.Real;

public class MyClass { }`;
            const result = extractCurrentNamespace(code);

            expect(result).toBeDefined();
            expect(result?.namespace).toBe('MyApp.Real');
        });

        test('should handle namespace with leading/trailing whitespace', () => {
            const code = `
namespace   MyApp.Spaces   
{
    public class MyClass { }
}`;
            const result = extractCurrentNamespace(code);

            expect(result).toBeDefined();
            expect(result?.namespace).toBe('MyApp.Spaces');
        });
    });

    describe('calculateNamespace', () => {
        test('should calculate namespace for root directory file', () => {
            const rootNamespace = 'MyApp';
            const projectUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.file('C:/Projects/MyApp/Program.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            expect(result).toBe('MyApp');
        });

        test('should calculate namespace for subdirectory file', () => {
            const rootNamespace = 'MyApp';
            const projectUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.file('C:/Projects/MyApp/Services/UserService.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            expect(result).toBe('MyApp.Services');
        });

        test('should calculate namespace for deeply nested file', () => {
            const rootNamespace = 'MyApp';
            const projectUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.file('C:/Projects/MyApp/Domain/Models/Entities/User.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            expect(result).toBe('MyApp.Domain.Models.Entities');
        });

        test('should handle Windows paths correctly', () => {
            const rootNamespace = 'MyApp';
            // Use vscode.Uri.parse with explicit file:// scheme for cross-platform compatibility
            const projectUri = vscode.Uri.parse('file:///D:/Projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.parse('file:///D:/Projects/MyApp/Controllers/HomeController.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            expect(result).toBe('MyApp.Controllers');
        });

        test('should handle Unix paths correctly', () => {
            const rootNamespace = 'MyApp';
            const projectUri = vscode.Uri.file('/home/user/projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.file('/home/user/projects/MyApp/Services/EmailService.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            expect(result).toBe('MyApp.Services');
        });

        test('should sanitize directory names with special characters', () => {
            const rootNamespace = 'MyApp';
            const projectUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.file('C:/Projects/MyApp/My-Services/My Service/UserService.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            expect(result).toBe('MyApp.My_Services.My_Service');
        });

        test('should handle directory names starting with numbers', () => {
            const rootNamespace = 'MyApp';
            const projectUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            const fileUri = vscode.Uri.file('C:/Projects/MyApp/3rdParty/Integration.cs');

            const result = calculateNamespace(rootNamespace, projectUri, fileUri);

            // In C#, identifiers (including namespace segments) cannot start with a digit.
            // Directory names starting with a digit are prefixed with an underscore in the namespace.
            expect(result).toBe('MyApp._3rdParty');
        });
    });
});
