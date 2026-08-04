/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe } from '@jest/globals';
import { RunAddTagHelperDirectiveSuite } from './addTagHelperDirective.ts';
import { RunAttributeDirectiveSuite } from './attributeDirective.ts';
import { RunCodeBlockSuite } from './codeBlock.ts';
import { RunCodeDirectiveSuite } from './codeDirective.ts';
import { RunDoStatementSuite } from './doStatement.ts';
import { RunElsePartSuite } from './elsePart.ts';
import { RunExplicitExpressionInAttributeSuite } from './explicitExpressionInAttribute.ts';
import { RunExplicitExpressionSuite } from './explicitExpressions.ts';
import { RunForeachStatementSuite } from './foreachStatement.ts';
import { RunForStatementSuite } from './forStatement.ts';
import { RunFunctionsDirectiveSuite } from './functionsDirective.ts';
import { RunIfStatementSuite } from './ifStatement.ts';
import { RunImplementsDirectiveSuite } from './implementsDirective.ts';
import { RunImplicitExpressionInAttributeSuite } from './implicitExpressionInAttribute.ts';
import { RunImplicitExpressionSuite } from './implicitExpressions.ts';
import { RunInheritsDirectiveSuite } from './inheritsDirective.ts';
import { RunInjectDirectiveSuite } from './injectDirective.ts';
import { RunLayoutDirectiveSuite } from './layoutDirective.ts';
import { RunLockStatementSuite } from './lockStatement.ts';
import { RunModelDirectiveSuite } from './modelDirective.ts';
import { RunNamespaceDirectiveSuite } from './namespaceDirective.ts';
import { RunPageDirectiveSuite } from './pageDirective.ts';
import { RunRazorCommentSuite } from './razorComment.ts';
import { RunRazorTemplateSuite } from './razorTemplate.ts';
import { RunRemoveTagHelperDirectiveSuite } from './removeTagHelperDirective.ts';
import { RunScriptBlockSuite } from './scriptBlock.ts';
import { RunSectionDirectiveSuite } from './sectionDirective.ts';
import { RunStyleBlockSuite } from './styleBlock.ts';
import { RunSwitchStatementSuite } from './switchStatement.ts';
import { RunTagHelperPrefixDirectiveSuite } from './tagHelperPrefixDirective.ts';
import { RunTransitionsSuite } from './transitions.ts';
import { RunTryStatementSuite } from './tryStatement.ts';
import { RunUsingDirectiveSuite } from './usingDirective.ts';
import { RunUsingStatementSuite } from './usingStatement.ts';
import { RunWhileStatementSuite } from './whileStatement.ts';
import { RunRendermodeDirectiveSuite } from './rendermodeDirective.ts';
import { RunPreservewhitespaceDirectiveSuite } from './preservewhitespaceDirective.ts';
import { RunTypeparamDirectiveSuite } from './typeparamDirective.ts';
import { RunHTMLDynamicAttributeSuite } from './htmlDynamicAttribute.ts';

// We bring together all test suites and wrap them in one here. The reason behind this is that
// modules get reloaded per test suite and the vscode-textmate library doesn't support the way
// that Jest reloads those modules. By wrapping all suites in one we can guaruntee that the
// modules don't get torn down inbetween suites.

describe('Grammar tests', () => {
    RunTransitionsSuite();
    RunExplicitExpressionSuite();
    RunExplicitExpressionInAttributeSuite();
    RunImplicitExpressionSuite();
    RunImplicitExpressionInAttributeSuite();
    RunCodeBlockSuite();
    RunRazorCommentSuite();
    RunRazorTemplateSuite();

    // Directives
    RunCodeDirectiveSuite();
    RunFunctionsDirectiveSuite();
    RunPageDirectiveSuite();
    RunAddTagHelperDirectiveSuite();
    RunRemoveTagHelperDirectiveSuite();
    RunTagHelperPrefixDirectiveSuite();
    RunModelDirectiveSuite();
    RunImplementsDirectiveSuite();
    RunInheritsDirectiveSuite();
    RunNamespaceDirectiveSuite();
    RunInjectDirectiveSuite();
    RunAttributeDirectiveSuite();
    RunSectionDirectiveSuite();
    RunLayoutDirectiveSuite();
    RunUsingDirectiveSuite();
    RunRendermodeDirectiveSuite();
    RunPreservewhitespaceDirectiveSuite();
    RunTypeparamDirectiveSuite();

    // Razor C# Control Structures
    RunUsingStatementSuite();
    RunIfStatementSuite();
    RunElsePartSuite();
    RunForStatementSuite();
    RunForeachStatementSuite();
    RunWhileStatementSuite();
    RunSwitchStatementSuite();
    RunLockStatementSuite();
    RunDoStatementSuite();
    RunTryStatementSuite();

    // Html stuff
    RunScriptBlockSuite();
    RunStyleBlockSuite();
    RunHTMLDynamicAttributeSuite();
});
