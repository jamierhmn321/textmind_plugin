import * as vscode from 'vscode';
import { TextMindClient } from '../api/client';

export async function viewUsageCommand(context: vscode.ExtensionContext) {
    const apiKey = await context.secrets.get('textmindApiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('TEXT MIND API key not configured');
        return;
    }
    
    const client = new TextMindClient(apiKey);
    
    try {
        const stats = await client.getUsageStats();
        
        const overage = stats.api_calls_overage > 0 
            ? `\n⚠️ Overage: ${stats.api_calls_overage} calls ($${(stats.api_calls_overage * 0.05).toFixed(2)})`
            : '';
        
        vscode.window.showInformationMessage(
            `📊 TEXT MIND Usage (This Month)\n\n` +
            `Tier: ${stats.billing_tier}\n` +
            `API Calls: ${stats.api_calls_this_month} / ${stats.api_calls_included}\n` +
            `Estimated Cost: $${stats.estimated_cost.toFixed(2)}${overage}`,
            'View Dashboard'
        ).then(selection => {
            if (selection === 'View Dashboard') {
                vscode.env.openExternal(vscode.Uri.parse('https://app.textmind.ai/usage'));
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to fetch usage: ${error.message}`);
    }
}
