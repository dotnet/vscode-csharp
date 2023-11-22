/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe } from '@jest/globals';
import { RunAddTagHelperDirectiveSuite } from './addTagHelperDirective';
import { RunAttributeDirectiveSuite } from './attributeDirective';
import { RunCodeBlockSuite } from './codeBlock';
import { RunCodeDirectiveSuite } from './codeDirective';
import { RunDoStatementSuite } from './doStatement';
import { RunElsePartSuite } from './elsePart';
import { RunExplicitExpressionInAttributeSuite } from './explicitExpressionInAttribute';
import { RunExplicitExpressionSuite } from './explicitExpressions';
import { RunForeachStatementSuite } from './foreachStatement';
import { RunForStatementSuite } from './forStatement';
import { RunFunctionsDirectiveSuite } from './functionsDirective';
import { RunIfStatementSuite } from './ifStatement';
import { RunImplementsDirectiveSuite } from './implementsDirective';
import { RunImplicitExpressionInAttributeSuite } from './implicitExpressionInAttribute';
import { RunImplicitExpressionSuite } from './implicitExpressions';
import { RunInheritsDirectiveSuite } from './inheritsDirective';
import { RunInjectDirectiveSuite } from './injectDirective';
import { RunLayoutDirectiveSuite } from './layoutDirective';
import { RunLockStatementSuite } from './lockStatement';
import { RunModelDirectiveSuite } from './modelDirective';
import { RunNamespaceDirectiveSuite } from './namespaceDirective';
import { RunPageDirectiveSuite } from './pageDirective';
import { RunRazorCommentSuite } from './razorComment';
import { RunRazorTemplateSuite } from './razorTemplate';
import { RunRemoveTagHelperDirectiveSuite } from './removeTagHelperDirective';
import { RunScriptBlockSuite } from './scriptBlock';
import { RunSectionDirectiveSuite } from './sectionDirective';
import { RunStyleBlockSuite } from './styleBlock';
import { RunSwitchStatementSuite } from './switchStatement';
import { RunTagHelperPrefixDirectiveSuite } from './tagHelperPrefixDirective';
import { RunTransitionsSuite } from './transitions';
import { RunTryStatementSuite } from './tryStatement';
import { RunUsingDirectiveSuite } from './usingDirective';
import { RunUsingStatementSuite } from './usingStatement';
import { RunWhileStatementSuite } from './whileStatement';

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
});
