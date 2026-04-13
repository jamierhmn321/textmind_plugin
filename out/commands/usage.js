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
exports.viewWorkflowCommand = viewWorkflowCommand;
/**
 * View Workflow command — look up any workflow by ID and display its status
 * and artifacts without going through the full generate flow.
 *
 * Useful for checking on a long-running workflow that was triggered earlier,
 * or for reviewing the artifacts of a completed workflow.
 */
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
async function viewWorkflowCommand() {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
    const workflowId = await vscode.window.showInputBox({
        title: 'Fortress — View Workflow',
        prompt: 'Enter the workflow ID returned by Pipeline 2',
        placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length > 0 ? null : 'Workflow ID cannot be empty',
    });
    if (!workflowId) {
        return;
    }
    try {
        const client = new client_1.Pipeline2Client(baseUrl);
        const result = await client.getWorkflow(workflowId.trim());
        const lines = [
            `Workflow ID : ${result.workflow_id}`,
            `JIRA Key    : ${result.jira_key}`,
            `Status      : ${result.status}`,
            `Quality     : ${result.quality_score}`,
            `Started     : ${result.started_at ?? 'n/a'}`,
            `Completed   : ${result.completed_at ?? 'n/a'}`,
        ];
        const choice = await vscode.window.showInformationMessage(lines.join('\n'), 'Show Artifacts', 'Show Test Code', 'Close');
        const artifacts = result.artifacts ?? {};
        if (choice === 'Show Artifacts') {
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(artifacts, null, 2),
                language: 'json',
            });
            await vscode.window.showTextDocument(doc, {
                preview: false,
                viewColumn: vscode.ViewColumn.Beside,
            });
        }
        else if (choice === 'Show Test Code') {
            const testCode = artifacts['test_code'] ??
                artifacts['generated_code'];
            if (testCode) {
                const doc = await vscode.workspace.openTextDocument({
                    content: testCode,
                    language: 'python',
                });
                await vscode.window.showTextDocument(doc, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Beside,
                });
            }
            else {
                vscode.window.showWarningMessage('No test_code in artifacts yet — the workflow may still be running.');
            }
        }
    }
    catch (err) {
        vscode.window.showErrorMessage(`Fortress: could not retrieve workflow — ${(0, client_1.extractErrorMessage)(err)}`);
    }
}
//# sourceMappingURL=usage.js.map