import * as vscode from 'vscode';
import { TextMindClient } from '../api/client';

export async function configureCommand(context: vscode.ExtensionContext) {
    // Get API key from user
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your TEXT MIND API key (get from https://app.textmind.ai)',
        placeHolder: 'tm_sk_xxxxxxxxxx',
        password: true,
        ignoreFocusOut: true
    });
    
    if (!apiKey) {
        vscode.window.showWarningMessage('API key is required to use TEXT MIND');
        return;
    }
    
    // Test connection
    const client = new TextMindClient(apiKey);
    const isValid = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Validating API key...',
        cancellable: false
    }, async () => {
        return await client.testConnection();
    });
    
    if (!isValid) {
        vscode.window.showErrorMessage('Invalid API key or connection failed');
        return;
    }
    
    // Store API key securely
    await context.secrets.store('textmindApiKey', apiKey);
    
    // Optionally configure JIRA URL
    const jiraUrl = await vscode.window.showInputBox({
        prompt: 'Enter your JIRA instance URL (optional)',
        placeHolder: 'https://yourcompany.atlassian.net',
        ignoreFocusOut: true
    });
    
    if (jiraUrl) {
        const config = vscode.workspace.getConfiguration('textmind');
        await config.update('jiraUrl', jiraUrl, vscode.ConfigurationTarget.Global);
    }
    
    vscode.window.showInformationMessage('✅ TEXT MIND configured successfully!');
}
