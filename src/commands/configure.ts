/**
 * Configure command — lets the user set (and validate) the Pipeline 2 URL.
 *
 * Pipeline 2 runs inside the customer VPC with no application-layer auth,
 * so all we need is the base URL (e.g. http://localhost:8000 or
 * https://fortress-pipeline2.internal).
 */
import * as vscode from 'vscode';
import { Pipeline2Client } from '../api/client';

export async function configureCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const current: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';

    const url = await vscode.window.showInputBox({
        title: 'Fortress — Configure Pipeline 2',
        prompt: 'Enter the base URL of your Pipeline 2 server (running inside your VPC)',
        placeHolder: 'http://54.174.78.213:8000',
        value: current,
        ignoreFocusOut: true,
        validateInput: (value) => {
            try {
                new URL(value);
                return null;
            } catch {
                return 'Please enter a valid URL (e.g. http://localhost:8000)';
            }
        },
    });

    if (!url) {
        return; // user cancelled
    }

    // Test connectivity before saving
    const reachable = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Fortress: checking Pipeline 2 connection…',
            cancellable: false,
        },
        async () => {
            try {
                const client = new Pipeline2Client(url);
                return await client.checkConnectivity();
            } catch {
                return false;
            }
        },
    );

    if (!reachable) {
        const choice = await vscode.window.showWarningMessage(
            `Could not reach Pipeline 2 at ${url}. Save anyway?`,
            'Save Anyway',
            'Cancel',
        );
        if (choice !== 'Save Anyway') {
            return;
        }
    }

    await cfg.update('pipeline2Url', url, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
        `Fortress: Pipeline 2 URL saved → ${url}`,
    );
}
