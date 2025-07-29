/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

function defaultAssertion<T>(value: T): void {
    if (value === undefined) {
        throw 'Default assertion of poll: Excepted value not to be undefined.';
    }

    if (Array.isArray(value) && value.length === 0) {
        throw "Default assertion of poll: Value was array but it got length of '0'.";
    }
}

export async function assertWithPoll<T>(
    getValue: () => T,
    duration: number,
    step: number,
    assertForValue: (input: T) => void = defaultAssertion
): Promise<void> {
    let assertResult: Error | undefined = undefined;

    while (duration > 0) {
        const value = await getValue();

        try {
            assertResult = undefined;
            assertForValue(value);
        } catch (error) {
            assertResult = error as Error;
        }

        if (assertResult === undefined) {
            return;
        }

        await sleep(step);

        duration -= step;
    }

    throw assertResult;
}

function defaultPollExpression<T>(value: T): boolean {
    return value !== undefined && ((Array.isArray(value) && value.length > 0) || (!Array.isArray(value) && !!value));
}

export async function pollDoesNotHappen<T>(
    getValue: () => T,
    duration: number,
    step: number,
    expression: (input: T) => boolean = defaultPollExpression
): Promise<void> {
    while (duration > 0) {
        const value = await getValue();

        if (expression(value)) {
            throw new Error('Polling succeeded within the alotted duration, but should not have.');
        }

        await sleep(step);

        duration -= step;
    }

    // Successfully never happened
}

export async function poll<T>(
    getValue: () => Promise<T> | T,
    duration: number,
    step: number,
    expression: (input: T) => boolean = defaultPollExpression
): Promise<T> {
    let value: T;

    while (duration > 0) {
        value = await getValue();

        if (expression(value)) {
            return value;
        }

        await sleep(step);

        duration -= step;
    }

    throw new Error('Polling did not succeed within the alotted duration.');
}

export async function sleep(ms = 0) {
    return new Promise((r) => setTimeout(r, ms));
}
