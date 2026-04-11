/**
 * View Workflow command — look up any workflow by ID and display its status
 * and artifacts without going through the full generate flow.
 *
 * Useful for checking on a long-running workflow that was triggered earlier,
 * or for reviewing the artifacts of a completed workflow.
 */
import * as vscode from 'vscode';
import { Pipeline2Client, extractErrorMessage } from '../api/client';

export async function viewWorkflowCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';

    const workflowId = await vscode.window.showInputBox({
        title: 'Fortress — View Workflow',
        prompt: 'Enter the workflow ID returned by Pipeline 2',
        placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v.trim().length > 0 ? null : 'Workflow ID cannot be empty',
    });

    if (!workflowId) {
        return;
    }

    try {
        const client = new Pipeline2Client(baseUrl);
        const result = await client.getWorkflow(workflowId.trim());

        const lines: string[] = [
            `Workflow ID : ${result.workflow_id}`,
            `JIRA Key    : ${result.jira_key}`,
            `Status      : ${result.status}`,
            `Quality     : ${result.quality_score}`,
            `Started     : ${result.started_at ?? 'n/a'}`,
            `Completed   : ${result.completed_at ?? 'n/a'}`,
        ];

        const choice = await vscode.window.showInformationMessage(
            lines.join('\n'),
            'Show Artifacts',
            'Show Test Code',
            'Close',
        );

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
        } else if (choice === 'Show Test Code') {
            const testCode =
                (artifacts['test_code'] as string | undefined) ??
                (artifacts['generated_code'] as string | undefined);

            if (testCode) {
                const doc = await vscode.workspace.openTextDocument({
                    content: testCode,
                    language: 'python',
                });
                await vscode.window.showTextDocument(doc, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Beside,
                });
            } else {
                vscode.window.showWarningMessage(
                    'No test_code in artifacts yet — the workflow may still be running.',
                );
            }
        }
    } catch (err) {
        vscode.window.showErrorMessage(
            `Fortress: could not retrieve workflow — ${extractErrorMessage(err)}`,
        );
    }
}
