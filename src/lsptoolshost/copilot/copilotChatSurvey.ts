/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { LanguageServerEvents, ServerState } from '../server/languageServerEvents';
import { ITelemetryReporter } from '../../shared/telemetryReporter';
import { TelemetryEventNames } from '../../shared/telemetryEventNames';

// Stored under separate keys so a snooze write can never overwrite a terminal "shown"
// value set in another window (globalState.update replaces the whole value for a key).
const shownStateKey = 'csharp.copilotChatSurvey.shown';
const snoozedUntilStateKey = 'csharp.copilotChatSurvey.snoozedUntil';

// Snooze applied after an ignored/closed toast, after which the survey becomes eligible again.
const ignoredSnoozeMs = 60 * 60 * 1000;

const surveyUrl = 'https://aka.ms/vscode-csharp-dotnetskills-general-survey';

/**
 * Offers a one-time feedback survey to C# extension customers using GitHub Copilot Chat.
 *
 * Deferred until project initialization completes so the toast doesn't contend with the burst of
 * startup notifications. Eligibility is gated on an available Copilot chat model. An ignored/closed
 * toast is snoozed rather than retired, so only an explicit choice permanently consumes the one-shot.
 */
export function registerCopilotChatSurvey(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    languageServerEvents: LanguageServerEvents,
    reporter: ITelemetryReporter,
    channel: vscode.LogOutputChannel
): void {
    if (hasSurveyBeenShown(context)) {
        return;
    }

    // Registration is gated on an async availability probe; fire-and-forget it.
    void registerSurveyWhenChatAvailable(context, languageServer, languageServerEvents, reporter, channel);
}

async function registerSurveyWhenChatAvailable(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    languageServerEvents: LanguageServerEvents,
    reporter: ITelemetryReporter,
    channel: vscode.LogOutputChannel
): Promise<void> {
    // Start observing before the async probe so an initialization that completes while the
    // probe is in flight (or already completed before we ran) isn't missed.
    const initialized = whenProjectInitialized(languageServer, languageServerEvents);
    try {
        if (!(await isCopilotChatAvailable())) {
            return;
        }
        await initialized.completed;

        if (hasSurveyBeenShown(context) || isSnoozed(context)) {
            return;
        }
        await showSurveyPrompt(context, reporter, channel);
    } finally {
        initialized.dispose();
    }
}

function whenProjectInitialized(
    languageServer: RoslynLanguageServer,
    languageServerEvents: LanguageServerEvents
): { completed: Promise<void>; dispose: () => void } {
    let disposable: vscode.Disposable | undefined;
    const completed = new Promise<void>((resolve) => {
        if (languageServer.state === ServerState.ProjectInitializationComplete) {
            resolve();
            return;
        }
        disposable = languageServerEvents.onServerStateChange((e) => {
            if (e.state === ServerState.ProjectInitializationComplete) {
                resolve();
            }
        });
    });
    return { completed, dispose: () => disposable?.dispose() };
}

/**
 * Whether the user can use Copilot Chat right now: at least one Copilot-vendor model is available
 * (i.e. Chat is set up and signed in). Returns false (never throws) if the query fails.
 */
async function isCopilotChatAvailable(): Promise<boolean> {
    try {
        // vscode.lm may be absent in older/limited hosts; optional chaining keeps this never-throws.
        const models = await vscode.lm?.selectChatModels({ vendor: 'copilot' });
        return (models?.length ?? 0) > 0;
    } catch {
        return false;
    }
}

function hasSurveyBeenShown(context: vscode.ExtensionContext): boolean {
    return context.globalState.get<boolean>(shownStateKey, false);
}

function isSnoozed(context: vscode.ExtensionContext): boolean {
    const snoozedUntil = context.globalState.get<string>(snoozedUntilStateKey);
    if (!snoozedUntil) {
        return false;
    }
    const until = Date.parse(snoozedUntil);
    return !Number.isNaN(until) && until > Date.now();
}

async function markSurveyShown(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(shownStateKey, true);
}

async function snoozeSurvey(context: vscode.ExtensionContext): Promise<void> {
    // Touches only the snooze key, so it can't clobber a terminal "shown" set in another window.
    await context.globalState.update(snoozedUntilStateKey, new Date(Date.now() + ignoredSnoozeMs).toISOString());
}

async function showSurveyPrompt(
    context: vscode.ExtensionContext,
    reporter: ITelemetryReporter,
    channel: vscode.LogOutputChannel
): Promise<void> {
    const takeAction = vscode.l10n.t('Take Survey');
    const dismiss = vscode.l10n.t('Not Now');
    const message = vscode.l10n.t(
        "You've been using GitHub Copilot Chat with the C# experience. We'd appreciate your feedback!"
    );

    try {
        // Count as shown up front: the toast is non-modal and may never be interacted with.
        reporter.sendTelemetryEvent(TelemetryEventNames.CopilotChatSurvey, { outcome: 'shown' });

        const result = await vscode.window.showInformationMessage(message, takeAction, dismiss);

        if (result === takeAction) {
            // Only retire once the browser actually opened; otherwise snooze so it can resurface.
            const opened = await vscode.env.openExternal(vscode.Uri.parse(surveyUrl));
            if (opened) {
                await markSurveyShown(context);
                reporter.sendTelemetryEvent(TelemetryEventNames.CopilotChatSurvey, { outcome: 'accepted' });
            } else {
                await snoozeSurvey(context);
            }
        } else if (result === dismiss) {
            await markSurveyShown(context);
            reporter.sendTelemetryEvent(TelemetryEventNames.CopilotChatSurvey, { outcome: 'dismissed' });
        } else {
            // Ignored or closed without a choice — snooze rather than retire.
            await snoozeSurvey(context);
        }
    } catch (error) {
        // Only the error type is sent, never user content.
        channel.error('Failed to show C# Copilot Chat survey prompt', error);
        reporter.sendTelemetryErrorEvent(TelemetryEventNames.CopilotChatSurveyError, {
            'error.name': error instanceof Error ? error.name : 'error',
        });
    }
}
