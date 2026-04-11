/**
 * Generate Tests command
 *
 * Collects a JIRA story key + description from the user, then submits it to
 * Pipeline 2's POST /webhooks/jira endpoint to trigger the 6-agent pipeline
 * (Discovery → Understanding → Framework → Generation → Validation → Execution).
 *
 * After triggering, the command polls GET /workflows/{id} until the workflow
 * completes, then displays the generated pytest code in a new editor tab.
 */
import * as vscode from 'vscode';
import {
    Pipeline2Client,
    WorkflowResult,
    extractErrorMessage,
} from '../api/client';

export async function generateTestsCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
    const pollInterval: number = cfg.get('pollIntervalMs') ?? 3000;
    const pollTimeout: number = cfg.get('pollTimeoutMs') ?? 300000;

    const client = new Pipeline2Client(baseUrl);

    // ── Step 1: Collect JIRA key ──────────────────────────────────────
    const jiraKey = await vscode.window.showInputBox({
        title: 'Fortress — Generate Tests',
        prompt: 'Enter the JIRA story key',
        placeHolder: 'BANK-456',
        ignoreFocusOut: true,
        validateInput: (v) =>
            /^[A-Z]+-\d+$/.test(v.trim())
                ? null
                : 'Use the format PROJECT-123 (e.g. BANK-456)',
    });

    if (!jiraKey) {
        return;
    }

    // ── Step 2: Collect story summary ─────────────────────────────────
    const summary = await vscode.window.showInputBox({
        title: `Fortress — ${jiraKey} Summary`,
        prompt: 'Enter the JIRA story summary (one line)',
        placeHolder: 'Wire transfer must screen OFAC SDN list before processing',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v.trim().length >= 10
                ? null
                : 'Please enter at least 10 characters',
    });

    if (!summary) {
        return;
    }

    // ── Step 3: Collect story description ─────────────────────────────
    const description = await vscode.window.showInputBox({
        title: `Fortress — ${jiraKey} Description`,
        prompt:
            'Enter the full JIRA story description (acceptance criteria, compliance notes, etc.)',
        placeHolder:
            'As a compliance officer, I need all wire transfers over $10,000 to be screened ' +
            'against the OFAC SDN list before processing. The system must block any transfer ' +
            'to a sanctioned entity and file a SAR within 30 days.',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v.trim().length >= 20
                ? null
                : 'Please enter at least 20 characters so the agents have enough context',
    });

    if (!description) {
        return;
    }

    // ── Step 4: Trigger workflow and poll ─────────────────────────────
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Fortress: generating tests for ${jiraKey}`,
            cancellable: false,
        },
        async (progress) => {
            try {
                // Submit to POST /webhooks/jira
                progress.report({ increment: 5, message: 'Submitting JIRA story to Pipeline 2…' });
                const trigger = await client.triggerWorkflow(
                    jiraKey.trim(),
                    summary.trim(),
                    description.trim(),
                );

                const workflowId = trigger.workflow_id;
                progress.report({
                    increment: 10,
                    message: `Workflow ${workflowId} started — running 6-agent pipeline…`,
                });

                // Agent step labels shown as the workflow progresses
                const agentSteps = [
                    'Discovery agent analysing story…',
                    'Understanding agent building semantic model…',
                    'Framework agent selecting test strategy…',
                    'Generation agent writing pytest code…',
                    'Validation agent checking compliance…',
                    'Execution agent running tests…',
                ];
                let stepIndex = 0;
                let lastStatus = '';

                const result: WorkflowResult = await client.pollWorkflow(
                    workflowId,
                    pollInterval,
                    pollTimeout,
                    (update) => {
                        if (update.status !== lastStatus) {
                            lastStatus = update.status;
                            const msg =
                                update.status === 'running'
                                    ? agentSteps[stepIndex++ % agentSteps.length]
                                    : update.status === 'waiting_approval'
                                    ? 'Waiting for human approval checkpoint…'
                                    : `Status: ${update.status}`;
                            progress.report({ increment: 10, message: msg });
                        }
                    },
                );

                // ── Handle waiting_approval ───────────────────────────
                if (result.status === 'waiting_approval') {
                    const approvals = await client.getPendingApprovals(workflowId);
                    const checkpoint =
                        approvals.length > 0 ? approvals[0].checkpoint : 'scenarios';

                    const decision = await vscode.window.showInformationMessage(
                        `Workflow ${workflowId} is waiting for approval at checkpoint: "${checkpoint}". Approve?`,
                        'Approve',
                        'Reject',
                    );

                    if (decision === 'Approve' || decision === 'Reject') {
                        await client.submitApproval(
                            workflowId,
                            checkpoint,
                            decision === 'Approve' ? 'approved' : 'rejected',
                        );

                        // Resume polling after approval
                        const finalResult = await client.pollWorkflow(
                            workflowId,
                            pollInterval,
                            pollTimeout,
                            () => {},
                        );
                        await showResult(finalResult, jiraKey);
                    }
                    return;
                }

                await showResult(result, jiraKey);
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Fortress: test generation failed — ${extractErrorMessage(err)}`,
                );
            }
        },
    );
}

async function showResult(result: WorkflowResult, jiraKey: string): Promise<void> {
    if (result.status === 'failed') {
        vscode.window.showErrorMessage(
            `Fortress: workflow failed for ${jiraKey}. Check Pipeline 2 logs.`,
        );
        return;
    }

    if (result.status !== 'completed') {
        vscode.window.showWarningMessage(
            `Fortress: workflow ended with status "${result.status}" for ${jiraKey}.`,
        );
        return;
    }

    const artifacts = result.artifacts ?? {};
    const testCode =
        (artifacts['test_code'] as string | undefined) ??
        (artifacts['generated_code'] as string | undefined);

    const qualityScore = result.quality_score;

    const choice = await vscode.window.showInformationMessage(
        `Fortress: tests generated for ${jiraKey} (quality score: ${qualityScore})`,
        'Open Test Code',
        'Show Artifacts',
    );

    if (choice === 'Open Test Code') {
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
                'No test_code found in workflow artifacts. The generation agent may still be running.',
            );
        }
    } else if (choice === 'Show Artifacts') {
        const doc = await vscode.workspace.openTextDocument({
            content: JSON.stringify(artifacts, null, 2),
            language: 'json',
        });
        await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside,
        });
    }
}
