/**
 * Health check command — verifies that Pipeline 2 is reachable and ready.
 * Calls GET /health/ and GET /health/ready.
 */
import * as vscode from 'vscode';
import { Pipeline2Client, extractErrorMessage } from '../api/client';

export async function checkHealthCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://fortress_api:8000';

    try {
        const client = new Pipeline2Client(baseUrl);

        const [healthResult, readyResult] = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Fortress: checking Pipeline 2 at ${baseUrl}…`,
                cancellable: false,
            },
            async () => {
                const h = await client.health();
                const r = await client.ready();
                return [h, r] as const;
            },
        );

        const deps = [
            `postgres: ${readyResult.postgres ? 'ok' : 'DOWN'}`,
            `redis: ${readyResult.redis ? 'ok' : 'DOWN'}`,
            `weaviate: ${readyResult.weaviate ? 'ok' : 'DOWN'}`,
        ].join('  ');

        if (readyResult.ready) {
            vscode.window.showInformationMessage(
                `Fortress Pipeline 2 — healthy\n` +
                `Service: ${healthResult.service}  ${deps}\n` +
                `URL: ${baseUrl}`,
            );
        } else {
            vscode.window.showWarningMessage(
                `Fortress Pipeline 2 — not ready\n` +
                `Service: ${healthResult.service}  ${deps}\n` +
                `URL: ${baseUrl}`,
            );
        }
    } catch (err) {
        const msg = extractErrorMessage(err);
        const configure = await vscode.window.showErrorMessage(
            `Fortress: Pipeline 2 not reachable at ${baseUrl} — ${msg}`,
            'Configure URL',
        );
        if (configure === 'Configure URL') {
            vscode.commands.executeCommand('fortress.configure');
        }
    }
}
