/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LanguageServerEvents, ServerState } from '../server/languageServerEvents';
import { ITelemetryReporter } from '../../shared/telemetryReporter';
import { TelemetryEventNames } from '../../shared/telemetryEventNames';

const globalStateKey = 'csharp.copilotChatSurvey';

// Snooze applied after an ignored/closed toast, after which the survey becomes eligible again.
const ignoredSnoozeMs = 60 * 60 * 1000;

const surveyUrl = 'https://aka.ms/vscode-csharp-dotnetskills-general-survey';

interface SurveyState {
    // Terminal one-shot: set only on an explicit choice ("Take Survey" / "Not Now").
    surveyShown: boolean;
    // ISO timestamp; while in the future the survey is snoozed (suppressed but not retired).
    snoozedUntil?: string;
}

/**
 * Offers a one-time feedback survey to C# extension customers using GitHub Copilot Chat.
 *
 * Deferred until project initialization completes so the toast doesn't contend with the burst of
 * startup notifications. Eligibility is gated on an available Copilot chat model. An ignored/closed
 * toast is snoozed rather than retired, so only an explicit choice permanently consumes the one-shot.
 */
export function registerCopilotChatSurvey(
    context: vscode.ExtensionContext,
    languageServerEvents: LanguageServerEvents,
    reporter: ITelemetryReporter,
    channel: vscode.LogOutputChannel
): void {
    if (getState(context).surveyShown === true) {
        return;
    }

    // Registration is gated on an async availability probe; fire-and-forget it.
    void registerSurveyWhenChatAvailable(context, languageServerEvents, reporter, channel);
}

async function registerSurveyWhenChatAvailable(
    context: vscode.ExtensionContext,
    languageServerEvents: LanguageServerEvents,
    reporter: ITelemetryReporter,
    channel: vscode.LogOutputChannel
): Promise<void> {
    // Bail before registering anything if the customer can't use Copilot Chat.
    if (!(await isCopilotChatAvailable())) {
        return;
    }

    // ProjectInitializationComplete can fire more than once per session (e.g. solution reload),
    // so dispose after the first prompt attempt.
    const disposable = languageServerEvents.onServerStateChange(async (e) => {
        if (e.state !== ServerState.ProjectInitializationComplete) {
            return;
        }

        const state = getState(context);
        if (state.surveyShown === true) {
            disposable.dispose();
            return;
        }
        // Snoozed: stay registered so a later initialization can re-surface it once it lapses.
        if (isSnoozed(state)) {
            return;
        }

        disposable.dispose();
        await showSurveyPrompt(context, reporter, channel);
    });
    context.subscriptions.push(disposable);
}

/**
 * Whether the user can use Copilot Chat right now: at least one Copilot-vendor model is available
 * (i.e. Chat is set up and signed in). Returns false (never throws) if the query fails.
 */
async function isCopilotChatAvailable(): Promise<boolean> {
    try {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        return models.length > 0;
    } catch {
        return false;
    }
}

function getState(context: vscode.ExtensionContext): SurveyState {
    return context.globalState.get<SurveyState>(globalStateKey, { surveyShown: false });
}

function isSnoozed(state: SurveyState): boolean {
    if (!state.snoozedUntil) {
        return false;
    }
    const until = Date.parse(state.snoozedUntil);
    return !Number.isNaN(until) && until > Date.now();
}

async function snoozeSurvey(context: vscode.ExtensionContext): Promise<void> {
    // globalState is shared across windows — never downgrade a terminal choice made elsewhere.
    if (getState(context).surveyShown) {
        return;
    }
    await context.globalState.update(globalStateKey, {
        surveyShown: false,
        snoozedUntil: new Date(Date.now() + ignoredSnoozeMs).toISOString(),
    });
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
                await context.globalState.update(globalStateKey, { surveyShown: true });
                reporter.sendTelemetryEvent(TelemetryEventNames.CopilotChatSurvey, { outcome: 'accepted' });
            } else {
                await snoozeSurvey(context);
            }
        } else if (result === dismiss) {
            await context.globalState.update(globalStateKey, { surveyShown: true });
            reporter.sendTelemetryEvent(TelemetryEventNames.CopilotChatSurvey, { outcome: 'dismissed' });
        } else {
            // Ignored or closed without a choice — snooze rather than retire.
            await snoozeSurvey(context);
        }
    } catch (error) {
        // Only the error type is sent, never user content.
        channel.error('Failed to show C# Copilot Chat survey prompt', error);
        reporter.sendTelemetryErrorEvent(TelemetryEventNames.CopilotChatSurveyError, {
            error: error instanceof Error ? error.name : 'error',
        });
    }
}
