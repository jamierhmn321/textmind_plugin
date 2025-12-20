import * as vscode from 'vscode';
import { TextMindClient } from '../api/client';

export async function generateTestsCommand(context: vscode.ExtensionContext) {
    // Get API key
    const apiKey = await context.secrets.get('textmindApiKey');
    if (!apiKey) {
        const configure = await vscode.window.showErrorMessage(
            'TEXT MIND API key not configured',
            'Configure Now'
        );
        if (configure) {
            vscode.commands.executeCommand('textmind.configure');
        }
        return;
    }
    
    // Get JIRA story key
    const storyKey = await vscode.window.showInputBox({
        prompt: 'Enter JIRA story key',
        placeHolder: 'BANK-456',
        validateInput: (value) => {
            return /^[A-Z]+-\d+$/.test(value) ? null : 'Invalid JIRA story key format';
        }
    });
    
    if (!storyKey) {
        return;
    }
    
    const client = new TextMindClient(apiKey);
    
    // Generate tests with progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Generating tests for ${storyKey}`,
        cancellable: false
    }, async (progress) => {
        try {
            // Start workflow
            progress.report({ increment: 0, message: 'Analyzing JIRA story...' });
            const workflow = await client.generateTests(storyKey);
            
            // Poll for completion
            let status = workflow;
            while (status.status === 'running' || status.status === 'pending') {
                await new Promise(resolve => setTimeout(resolve, 3000));
                status = await client.getWorkflowStatus(workflow.id);
                
                if (status.status === 'running') {
                    progress.report({ increment: 10, message: 'Generating test scenarios...' });
                }
            }
            
            if (status.status === 'waiting_approval') {
                progress.report({ increment: 80, message: 'Awaiting approval...' });
                
                // Show scenarios for approval
                const scenarios = status.scenarios || [];
                const scenarioList = scenarios.map((s, i) => 
                    `${i + 1}. ${s.title}`
                ).join('\n');
                
                const decision = await vscode.window.showInformationMessage(
                    `Generated ${scenarios.length} test scenarios:\n\n${scenarioList}\n\nApprove?`,
                    'Approve All',
                    'Reject',
                    'View Details'
                );
                
                if (decision === 'Approve All') {
                    await client.approveScenarios(workflow.id, 'approved');
                    vscode.window.showInformationMessage('✅ Tests approved! Generating code...');
                    
                    // Continue polling
                    status = await client.getWorkflowStatus(workflow.id);
                    while (status.status !== 'completed' && status.status !== 'failed') {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        status = await client.getWorkflowStatus(workflow.id);
                    }
                }
            }
            
            if (status.status === 'completed') {
                progress.report({ increment: 100, message: 'Done!' });
                
                const openFile = await vscode.window.showInformationMessage(
                    `✅ Tests generated successfully for ${storyKey}!`,
                    'View Test Code',
                    'View in JIRA'
                );
                
                if (openFile === 'View Test Code' && status.test_code) {
                    const doc = await vscode.workspace.openTextDocument({
                        content: status.test_code,
                        language: 'python'
                    });
                    await vscode.window.showTextDocument(doc);
                }
            } else {
                throw new Error('Test generation failed');
            }
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to generate tests: ${error.message}`);
        }
    });
}
