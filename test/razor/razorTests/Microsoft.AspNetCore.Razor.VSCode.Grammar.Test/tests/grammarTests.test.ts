/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe } from '@jest/globals';
import { RunAddTagHelperDirectiveSuite } from './addTagHelperDirective.js';
import { RunAttributeDirectiveSuite } from './attributeDirective.js';
import { RunCodeBlockSuite } from './codeBlock.js';
import { RunCodeDirectiveSuite } from './codeDirective.js';
import { RunDoStatementSuite } from './doStatement.js';
import { RunElsePartSuite } from './elsePart.js';
import { RunExplicitExpressionInAttributeSuite } from './explicitExpressionInAttribute.js';
import { RunExplicitExpressionSuite } from './explicitExpressions.js';
import { RunForeachStatementSuite } from './foreachStatement.js';
import { RunForStatementSuite } from './forStatement.js';
import { RunFunctionsDirectiveSuite } from './functionsDirective.js';
import { RunIfStatementSuite } from './ifStatement.js';
import { RunImplementsDirectiveSuite } from './implementsDirective.js';
import { RunImplicitExpressionInAttributeSuite } from './implicitExpressionInAttribute.js';
import { RunImplicitExpressionSuite } from './implicitExpressions.js';
import { RunInheritsDirectiveSuite } from './inheritsDirective.js';
import { RunInjectDirectiveSuite } from './injectDirective.js';
import { RunLayoutDirectiveSuite } from './layoutDirective.js';
import { RunLockStatementSuite } from './lockStatement.js';
import { RunModelDirectiveSuite } from './modelDirective.js';
import { RunNamespaceDirectiveSuite } from './namespaceDirective.js';
import { RunPageDirectiveSuite } from './pageDirective.js';
import { RunRazorCommentSuite } from './razorComment.js';
import { RunRazorTemplateSuite } from './razorTemplate.js';
import { RunRemoveTagHelperDirectiveSuite } from './removeTagHelperDirective.js';
import { RunScriptBlockSuite } from './scriptBlock.js';
import { RunSectionDirectiveSuite } from './sectionDirective.js';
import { RunStyleBlockSuite } from './styleBlock.js';
import { RunSwitchStatementSuite } from './switchStatement.js';
import { RunTagHelperPrefixDirectiveSuite } from './tagHelperPrefixDirective.js';
import { RunTransitionsSuite } from './transitions.js';
import { RunTryStatementSuite } from './tryStatement.js';
import { RunUsingDirectiveSuite } from './usingDirective.js';
import { RunUsingStatementSuite } from './usingStatement.js';
import { RunWhileStatementSuite } from './whileStatement.js';
import { RunRendermodeDirectiveSuite } from './rendermodeDirective.js';
import { RunPreservewhitespaceDirectiveSuite } from './preservewhitespaceDirective.js';
import { RunTypeparamDirectiveSuite } from './typeparamDirective.js';
import { RunHTMLDynamicAttributeSuite } from './htmlDynamicAttribute.js';

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
