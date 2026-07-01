/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
    detectFileBasedAppKind,
    FileBasedAppKind,
    isInProjectCone,
    isLikelyFbaEntryPoint,
} from '../../../src/lsptoolshost/fileBasedApps/convertToProject';

// ---------------------------------------------------------------------------
// detectFileBasedAppKind
// ---------------------------------------------------------------------------

describe('detectFileBasedAppKind', () => {
    const tempDir = path.join(__dirname, '.convertToProject-test-files');
    const tempFiles: string[] = [];

    beforeEach(() => {
        fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        for (const filePath of tempFiles.splice(0)) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                // Ignore cleanup failures.
            }
        }

        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup failures.
        }
    });

    function writeTempFile(content: string): string {
        const filePath = path.join(tempDir, `app-${Date.now()}-${tempFiles.length}.cs`);
        fs.writeFileSync(filePath, content);
        tempFiles.push(filePath);
        return filePath;
    }

    describe('Shebang detection', () => {
        test('returns Shebang for a file starting with #!', () => {
            const filePath = writeTempFile('#!/usr/bin/env dotnet\nConsole.WriteLine("hi");\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.Shebang);
        });

        test('returns Shebang when file starts with BOM then #!', () => {
            const filePath = writeTempFile('\uFEFF#!/usr/bin/env dotnet\nConsole.WriteLine("hi");\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.Shebang);
        });

        test('does not return Shebang when #! appears after a non-empty line', () => {
            const filePath = writeTempFile('using System;\n#!/usr/bin/env dotnet\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.None);
        });
    });

    describe('Directives detection', () => {
        test('returns Directives for a file starting with #: package directive', () => {
            const filePath = writeTempFile('#:package Newtonsoft.Json@13.0.3\nConsole.WriteLine("hi");\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.Directives);
        });

        test('returns Directives for a file starting with #: sdk directive', () => {
            const filePath = writeTempFile('#:sdk Microsoft.NET.Sdk.Web\nConsole.WriteLine("hi");\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.Directives);
        });

        test('returns Directives when #: directive is preceded only by blank lines', () => {
            const filePath = writeTempFile('\n\n#:package Newtonsoft.Json@13.0.3\nConsole.WriteLine("hi");\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.Directives);
        });

        test('returns Directives when BOM precedes a #: directive', () => {
            const filePath = writeTempFile('\uFEFF#:package Newtonsoft.Json@13.0.3\nConsole.WriteLine("hi");\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.Directives);
        });

        test('does not return Directives when #: appears after 5 non-blank lines', () => {
            const filePath = writeTempFile(
                ['line1', 'line2', 'line3', 'line4', 'line5', '#:package Foo@1.0.0'].join('\n')
            );
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.None);
        });
    });

    describe('None cases', () => {
        test('returns None for a normal C# class file', () => {
            const filePath = writeTempFile('using System;\n\nnamespace Foo {\n    public class Bar {}\n}\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.None);
        });

        test('returns None for an empty file', () => {
            const filePath = writeTempFile('');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.None);
        });

        test('returns None when the file does not exist (unreadable)', () => {
            expect(detectFileBasedAppKind('/nonexistent/path/that/does/not/exist.cs')).toBe(FileBasedAppKind.None);
        });

        test('returns None for a file that only has blank lines', () => {
            const filePath = writeTempFile('\n\n\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.None);
        });

        test('returns None when #: appears inside a string literal on the first line', () => {
            // The algorithm checks trimmed lines; this line does NOT start with #:
            const filePath = writeTempFile('var s = "#: not a directive";\n');
            expect(detectFileBasedAppKind(filePath)).toBe(FileBasedAppKind.None);
        });
    });
});

// ---------------------------------------------------------------------------
// isInProjectCone
// ---------------------------------------------------------------------------

describe('isInProjectCone', () => {
    const sep = path.sep;

    function dirs(...paths: string[]): Set<string> {
        return new Set(paths);
    }

    test('returns true when the file is directly inside a csproj directory', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}project`);
        expect(isInProjectCone(`${sep}workspace${sep}project${sep}Foo.cs`, csprojDirs)).toBe(true);
    });

    test('returns true when the file is in a subdirectory of a csproj directory', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}project`);
        expect(isInProjectCone(`${sep}workspace${sep}project${sep}src${sep}Foo.cs`, csprojDirs)).toBe(true);
    });

    test('returns false when the file has no csproj in any ancestor directory', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}project`);
        expect(isInProjectCone(`${sep}workspace${sep}scripts${sep}app.cs`, csprojDirs)).toBe(false);
    });

    test('returns false when csprojDirs is empty', () => {
        expect(isInProjectCone(`${sep}workspace${sep}scripts${sep}app.cs`, new Set())).toBe(false);
    });

    test('returns false when the csproj directory is a sibling, not an ancestor', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}projectA`);
        expect(isInProjectCone(`${sep}workspace${sep}projectB${sep}Foo.cs`, csprojDirs)).toBe(false);
    });

    test('returns true when a file is multiple levels deep under a csproj directory', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}project`);
        expect(isInProjectCone(`${sep}workspace${sep}project${sep}a${sep}b${sep}c${sep}Foo.cs`, csprojDirs)).toBe(true);
    });

    test('handles multiple csproj directories -- returns true if any ancestor matches', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}projectA`, `${sep}workspace${sep}projectB`);
        expect(isInProjectCone(`${sep}workspace${sep}projectB${sep}Foo.cs`, csprojDirs)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// isLikelyFbaEntryPoint
// ---------------------------------------------------------------------------

describe('isLikelyFbaEntryPoint', () => {
    const sep = path.sep;
    const fileInCone = `${sep}workspace${sep}project${sep}app.cs`;
    const fileOutsideCone = `${sep}workspace${sep}scripts${sep}app.cs`;
    const csprojDirs = new Set([`${sep}workspace${sep}project`]);

    test('returns false for a file in a csproj cone without file-based app directives', () => {
        expect(isLikelyFbaEntryPoint(fileInCone, FileBasedAppKind.None, csprojDirs)).toBe(false);
    });

    test('returns true for a shebang file in a csproj cone', () => {
        expect(isLikelyFbaEntryPoint(fileInCone, FileBasedAppKind.Shebang, csprojDirs)).toBe(true);
    });

    test('returns true for a directives file in a csproj cone', () => {
        expect(isLikelyFbaEntryPoint(fileInCone, FileBasedAppKind.Directives, csprojDirs)).toBe(true);
    });

    test('returns true for a file outside any csproj cone without directives', () => {
        expect(isLikelyFbaEntryPoint(fileOutsideCone, FileBasedAppKind.None, csprojDirs)).toBe(true);
    });
});
