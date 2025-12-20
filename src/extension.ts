import * as vscode from 'vscode';
import { TextMindClient } from './api/client';
import { configureCommand } from './commands/configure';
import { generateTestsCommand } from './commands/generateTests';
import { viewUsageCommand } from './commands/usage';

export function activate(context: vscode.ExtensionContext) {
    console.log('TEXT MIND extension is now active');
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('textmind.configure', () => configureCommand(context))
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('textmind.generateTests', () => generateTestsCommand(context))
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('textmind.viewUsage', () => viewUsageCommand(context))
    );
    
    // Check if API key is configured
    const apiKey = context.globalState.get<string>('textmindApiKey');
    if (!apiKey) {
        vscode.window.showInformationMessage(
            'Welcome to TEXT MIND! Configure your API key to get started.',
            'Configure Now'
        ).then(selection => {
            if (selection === 'Configure Now') {
                vscode.commands.executeCommand('textmind.configure');
            }
        });
    }
}

export function deactivate() {}
