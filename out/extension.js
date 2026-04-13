"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
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
const vscode = __importStar(require("vscode"));
const configure_1 = require("./commands/configure");
const health_1 = require("./commands/health");
const generateTests_1 = require("./commands/generateTests");
const usage_1 = require("./commands/usage");
const validateWireTransfer_1 = require("./commands/validateWireTransfer");
const validateOFAC_1 = require("./commands/validateOFAC");
const validateLoan_1 = require("./commands/validateLoan");
const JiraPanel_1 = require("./providers/JiraPanel");
const WorkflowPanel_1 = require("./providers/WorkflowPanel");
const ValidationPanel_1 = require("./providers/ValidationPanel");
function activate(context) {
    try {
        _activate(context);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Fortress: extension failed to activate — ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
}
function _activate(context) {
    // ── Commands ──────────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('fortress.configure', () => (0, configure_1.configureCommand)()));
    context.subscriptions.push(vscode.commands.registerCommand('fortress.checkHealth', () => (0, health_1.checkHealthCommand)()));
    context.subscriptions.push(vscode.commands.registerCommand('fortress.generateTests', () => (0, generateTests_1.generateTestsCommand)()));
    context.subscriptions.push(vscode.commands.registerCommand('fortress.viewWorkflow', () => (0, usage_1.viewWorkflowCommand)()));
    context.subscriptions.push(vscode.commands.registerCommand('fortress.validateWireTransfer', () => (0, validateWireTransfer_1.validateWireTransferCommand)()));
    context.subscriptions.push(vscode.commands.registerCommand('fortress.validateOFAC', () => (0, validateOFAC_1.validateOFACCommand)()));
    context.subscriptions.push(vscode.commands.registerCommand('fortress.validateLoan', () => (0, validateLoan_1.validateLoanCommand)()));
    // ── Sidebar webview providers ─────────────────────────────────────
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(JiraPanel_1.JiraPanel.viewId, new JiraPanel_1.JiraPanel()));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(WorkflowPanel_1.WorkflowPanel.viewId, new WorkflowPanel_1.WorkflowPanel()));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ValidationPanel_1.ValidationPanel.viewId, new ValidationPanel_1.ValidationPanel()));
    // ── First-run prompt ──────────────────────────────────────────────
    const cfg = vscode.workspace.getConfiguration('fortress');
    const savedUrl = cfg.get('pipeline2Url') ?? '';
    if (!savedUrl || savedUrl === 'http://fortress_api:8000') {
        vscode.window
            .showInformationMessage('Fortress: configure your Pipeline 2 URL to get started.', 'Configure', 'Dismiss')
            .then((sel) => {
            if (sel === 'Configure') {
                vscode.commands.executeCommand('fortress.configure');
            }
        });
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map