/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import * as path from 'path';
import {
    detectFileBasedAppKind,
    FileBasedAppKind,
    isInProjectCone,
    shouldShowConvertToProjectOption,
} from '../../../src/lsptoolshost/fileBasedApps/convertToProject';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a `readFileHead` stub that returns a fixed string. */
function makeReader(content: string): (p: string) => string | null {
    return (_p: string) => content;
}

/** A reader that always simulates an unreadable file. */
const nullReader: (p: string) => string | null = (_p) => null;

// ---------------------------------------------------------------------------
// detectFileBasedAppKind
// ---------------------------------------------------------------------------

describe('detectFileBasedAppKind', () => {
    describe('Shebang detection', () => {
        test('returns Shebang for a file starting with #!', () => {
            expect(
                detectFileBasedAppKind('/a/app.cs', makeReader('#!/usr/bin/env dotnet\nConsole.WriteLine("hi");\n'))
            ).toBe(FileBasedAppKind.Shebang);
        });

        test('returns Shebang when file starts with BOM then #!', () => {
            expect(
                detectFileBasedAppKind(
                    '/a/app.cs',
                    makeReader('\uFEFF#!/usr/bin/env dotnet\nConsole.WriteLine("hi");\n')
                )
            ).toBe(FileBasedAppKind.Shebang);
        });

        test('does not return Shebang when #! appears after a non-empty line', () => {
            const content = 'using System;\n#!/usr/bin/env dotnet\n';
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.None);
        });
    });

    describe('Directives detection', () => {
        test('returns Directives for a file starting with #: package directive', () => {
            const content = '#:package Newtonsoft.Json@13.0.3\nConsole.WriteLine("hi");\n';
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.Directives);
        });

        test('returns Directives for a file starting with #: sdk directive', () => {
            const content = '#:sdk Microsoft.NET.Sdk.Web\nConsole.WriteLine("hi");\n';
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.Directives);
        });

        test('returns Directives when #: directive is preceded only by blank lines', () => {
            const content = '\n\n#:package Newtonsoft.Json@13.0.3\nConsole.WriteLine("hi");\n';
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.Directives);
        });

        test('returns Directives when BOM precedes a #: directive', () => {
            const content = '\uFEFF#:package Newtonsoft.Json@13.0.3\nConsole.WriteLine("hi");\n';
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.Directives);
        });

        test('does not return Directives when #: appears after 5 non-blank lines', () => {
            const content = ['line1', 'line2', 'line3', 'line4', 'line5', '#:package Foo@1.0.0'].join('\n');
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.None);
        });
    });

    describe('None cases', () => {
        test('returns None for a normal C# class file', () => {
            const content = 'using System;\n\nnamespace Foo {\n    public class Bar {}\n}\n';
            expect(detectFileBasedAppKind('/a/Bar.cs', makeReader(content))).toBe(FileBasedAppKind.None);
        });

        test('returns None for an empty file', () => {
            expect(detectFileBasedAppKind('/a/empty.cs', makeReader(''))).toBe(FileBasedAppKind.None);
        });

        test('returns None when the reader returns null (unreadable file)', () => {
            expect(detectFileBasedAppKind('/a/unreadable.cs', nullReader)).toBe(FileBasedAppKind.None);
        });

        test('returns None for a file that only has blank lines', () => {
            expect(detectFileBasedAppKind('/a/blank.cs', makeReader('\n\n\n'))).toBe(FileBasedAppKind.None);
        });

        test('returns None when #: appears inside a string literal on the first line', () => {
            // The algorithm checks trimmed lines; this line does NOT start with #:
            const content = 'var s = "#: not a directive";\n';
            expect(detectFileBasedAppKind('/a/app.cs', makeReader(content))).toBe(FileBasedAppKind.None);
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

    test('handles multiple csproj directories — returns true if any ancestor matches', () => {
        const csprojDirs = dirs(`${sep}workspace${sep}projectA`, `${sep}workspace${sep}projectB`);
        expect(isInProjectCone(`${sep}workspace${sep}projectB${sep}Foo.cs`, csprojDirs)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// shouldShowConvertToProjectOption
// ---------------------------------------------------------------------------

describe('shouldShowConvertToProjectOption', () => {
    const sep = path.sep;
    const fileInCone = `${sep}workspace${sep}project${sep}app.cs`;
    const fileOutsideCone = `${sep}workspace${sep}scripts${sep}app.cs`;
    const csprojDirs = new Set([`${sep}workspace${sep}project`]);

    test('returns false for a file in a csproj cone without file-based app directives', () => {
        expect(shouldShowConvertToProjectOption(fileInCone, FileBasedAppKind.None, csprojDirs)).toBe(false);
    });

    test('returns true for a shebang file in a csproj cone', () => {
        expect(shouldShowConvertToProjectOption(fileInCone, FileBasedAppKind.Shebang, csprojDirs)).toBe(true);
    });

    test('returns true for a directives file in a csproj cone', () => {
        expect(shouldShowConvertToProjectOption(fileInCone, FileBasedAppKind.Directives, csprojDirs)).toBe(true);
    });

    test('returns true for a file outside any csproj cone without directives', () => {
        expect(shouldShowConvertToProjectOption(fileOutsideCone, FileBasedAppKind.None, csprojDirs)).toBe(true);
    });
});
