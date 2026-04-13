/**
 * Configure command — lets the user set (and validate) the Pipeline 2 URL
 * and optional API key.
 *
 * The URL points to the FastAPI server running inside the customer VPC.
 * The API key is only required when Pipeline 2 is exposed via API Gateway
 * outside the VPC (sent as X-API-Key header).
 */
import * as vscode from 'vscode';
import { Pipeline2Client } from '../api/client';

export async function configureCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const currentUrl: string = cfg.get('pipeline2Url') ?? '';
    const currentKey: string = cfg.get('apiKey') ?? '';

    // Step 1 — URL
    const url = await vscode.window.showInputBox({
        title: 'Fortress — Configure Pipeline 2 (1/2)',
        prompt: 'Enter the base URL of your Pipeline 2 server (running inside your VPC)',
        placeHolder: 'http://54.174.78.213:8000',
        value: currentUrl,
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

    // Step 2 — API key (optional)
    const apiKey = await vscode.window.showInputBox({
        title: 'Fortress — Configure Pipeline 2 (2/2)',
        prompt: 'Enter your API key (leave blank if Pipeline 2 is accessed directly inside the VPC)',
        placeHolder: 'Leave blank if not required',
        value: currentKey,
        password: true,
        ignoreFocusOut: true,
    });

    if (apiKey === undefined) {
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
                const client = new Pipeline2Client(url, apiKey || undefined);
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
    await cfg.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
        `Fortress: Pipeline 2 URL saved → ${url}`,
    );
}
