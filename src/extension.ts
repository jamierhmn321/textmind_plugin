/**
 * Fortress VS Code Extension — entry point
 *
 * Registers all commands and sidebar webview providers that talk to Pipeline 2.
 *
 * Commands:
 *   fortress.configure            — set Pipeline 2 base URL
 *   fortress.checkHealth          — ping /health/ and /health/ready
 *   fortress.generateTests        — submit JIRA story → 6-agent pipeline
 *   fortress.viewWorkflow         — look up any workflow by ID
 *   fortress.validateWireTransfer — POST /validate/wire-transfer
 *   fortress.validateOFAC         — POST /validate/ofac-screen
 *   fortress.validateLoan         — POST /validate/loan-application
 *
 * Sidebar views (WebviewViewProvider):
 *   fortressJiraPanel       — Generate Tests form
 *   fortressWorkflowPanel   — Workflow Status lookup
 *   fortressValidationPanel — Compliance Validation tabs
 */
import * as vscode from 'vscode';
import { configureCommand } from './commands/configure';
import { checkHealthCommand } from './commands/health';
import { generateTestsCommand } from './commands/generateTests';
import { viewWorkflowCommand } from './commands/usage';
import { validateWireTransferCommand } from './commands/validateWireTransfer';
import { validateOFACCommand } from './commands/validateOFAC';
import { validateLoanCommand } from './commands/validateLoan';
import { JiraPanel } from './providers/JiraPanel';
import { WorkflowPanel } from './providers/WorkflowPanel';
import { ValidationPanel } from './providers/ValidationPanel';

export function activate(context: vscode.ExtensionContext): void {
    // ── Commands ──────────────────────────────────────────────────────

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.configure', () =>
            configureCommand(),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.checkHealth', () =>
            checkHealthCommand(),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.generateTests', () =>
            generateTestsCommand(),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.viewWorkflow', () =>
            viewWorkflowCommand(),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.validateWireTransfer', () =>
            validateWireTransferCommand(),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.validateOFAC', () =>
            validateOFACCommand(),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fortress.validateLoan', () =>
            validateLoanCommand(),
        ),
    );

    // ── Sidebar webview providers ─────────────────────────────────────

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            JiraPanel.viewId,
            new JiraPanel(),
        ),
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WorkflowPanel.viewId,
            new WorkflowPanel(),
        ),
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ValidationPanel.viewId,
            new ValidationPanel(),
        ),
    );

    // ── First-run prompt ──────────────────────────────────────────────
    const cfg = vscode.workspace.getConfiguration('fortress');
    const savedUrl: string = cfg.get('pipeline2Url') ?? '';

    if (!savedUrl || savedUrl === 'http://fortress_api:8000') {
        vscode.window
            .showInformationMessage(
                'Fortress: configure your Pipeline 2 URL to get started.',
                'Configure',
                'Dismiss',
            )
            .then((sel) => {
                if (sel === 'Configure') {
                    vscode.commands.executeCommand('fortress.configure');
                }
            });
    }
}

export function deactivate(): void {}
