/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { LogObserver } from '../../../src/lsptoolshost/logging/observableLogOutputChannel';

describe('captureActivityLogs', () => {
    describe('LogObserver', () => {
        test('formatLogMessages returns empty string for empty array', () => {
            const result = LogObserver.formatLogMessages([]);
            expect(result).toBe('');
        });

        test('formatLogMessages includes timestamp, level, and message', () => {
            const timestamp = new Date('2024-01-01T12:00:00.000Z');
            const messages = [{ level: 'info' as const, message: 'test message', timestamp }];
            const result = LogObserver.formatLogMessages(messages);
            expect(result).toContain('2024-01-01T12:00:00.000Z');
            expect(result).toContain('INFO');
            expect(result).toContain('test message');
        });

        test('formatLogMessages formats multiple messages with newlines', () => {
            const timestamp = new Date('2024-01-01T12:00:00.000Z');
            const messages = [
                { level: 'info' as const, message: 'first', timestamp },
                { level: 'error' as const, message: 'second', timestamp },
            ];
            const result = LogObserver.formatLogMessages(messages);
            const lines = result.split('\n');
            expect(lines).toHaveLength(2);
            expect(lines[0]).toContain('INFO');
            expect(lines[0]).toContain('first');
            expect(lines[1]).toContain('ERROR');
            expect(lines[1]).toContain('second');
        });
    });
});
