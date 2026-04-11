/**
 * Validate OFAC command
 *
 * Calls Pipeline 2's POST /validate/ofac-screen endpoint, which runs the
 * OFACScreener against the locally-synced SDN list (no data leaves the VPC).
 *
 * Checks performed by Pipeline 2:
 *   - Fuzzy name matching against OFAC SDN list
 *   - Country-based sanctions programme lookup
 *   - Real-time blocking decision
 */
import * as vscode from 'vscode';
import { Pipeline2Client, extractErrorMessage } from '../api/client';
import { showValidationResult } from './validateWireTransfer';

export async function validateOFACCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';

    const partyName = await vscode.window.showInputBox({
        title: 'Fortress — OFAC Sanctions Screen',
        prompt: 'Party name to screen (individual or entity)',
        placeHolder: 'Acme Trading LLC',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v.trim().length >= 2 ? null : 'Please enter at least 2 characters',
    });
    if (!partyName) { return; }

    const partyCountry = await vscode.window.showInputBox({
        title: 'Fortress — OFAC Sanctions Screen',
        prompt: 'Party country code (2-letter ISO, optional)',
        placeHolder: 'IR',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v === '' || /^[A-Z]{2}$/i.test(v.trim()) ? null : 'Use 2-letter ISO country code',
    });
    if (partyCountry === undefined) { return; }

    try {
        const client = new Pipeline2Client(baseUrl);

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Fortress: screening "${partyName}" against OFAC SDN list…`,
                cancellable: false,
            },
            () =>
                client.screenOFAC({
                    party_name: partyName.trim(),
                    party_country: partyCountry.trim().toUpperCase() || undefined,
                }),
        );

        await showValidationResult('OFAC Screen', result.action, result.violations, result.latency_ms);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Fortress: OFAC screen failed — ${extractErrorMessage(err)}`,
        );
    }
}
