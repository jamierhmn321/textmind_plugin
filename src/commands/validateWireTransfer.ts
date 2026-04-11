/**
 * Validate Wire Transfer command
 *
 * Calls Pipeline 2's POST /validate/wire-transfer endpoint, which runs the
 * WireTransferValidator against OCC BSA/AML rules using the locally-synced
 * compliance database (no data leaves the VPC).
 *
 * Checks performed by Pipeline 2:
 *   - OFAC SDN screening of beneficiary
 *   - CTR threshold ($10,000 cash reporting)
 *   - Travel Rule ($3,000+ recordkeeping)
 *   - Dual-approval requirement for large wires
 *   - International wire restrictions
 */
import * as vscode from 'vscode';
import { Pipeline2Client, Violation, extractErrorMessage } from '../api/client';

export async function validateWireTransferCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';

    // ── Collect inputs ────────────────────────────────────────────────
    const amountStr = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Transfer amount (USD)',
        placeHolder: '15000',
        ignoreFocusOut: true,
        validateInput: (v) => {
            const n = parseFloat(v);
            return !isNaN(n) && n > 0 ? null : 'Please enter a positive number';
        },
    });
    if (!amountStr) { return; }

    const senderName = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Sender full name',
        placeHolder: 'John Smith',
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length >= 2 ? null : 'Name too short',
    });
    if (!senderName) { return; }

    const beneficiaryName = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Beneficiary full name',
        placeHolder: 'Acme Corp',
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length >= 2 ? null : 'Name too short',
    });
    if (!beneficiaryName) { return; }

    const beneficiaryCountry = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Beneficiary country code (2-letter ISO, leave blank for US)',
        placeHolder: 'US',
        value: 'US',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v === '' || /^[A-Z]{2}$/i.test(v.trim()) ? null : 'Use 2-letter ISO country code (e.g. US, GB)',
    });
    if (beneficiaryCountry === undefined) { return; }

    const isIntl = beneficiaryCountry.toUpperCase() !== 'US' && beneficiaryCountry !== '';

    // ── Call API ──────────────────────────────────────────────────────
    try {
        const client = new Pipeline2Client(baseUrl);

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fortress: running wire transfer compliance check…',
                cancellable: false,
            },
            () =>
                client.validateWireTransfer({
                    amount: parseFloat(amountStr),
                    currency: 'USD',
                    sender_name: senderName.trim(),
                    beneficiary_name: beneficiaryName.trim(),
                    beneficiary_country: (beneficiaryCountry || 'US').toUpperCase(),
                    is_international: isIntl,
                }),
        );

        await showValidationResult('Wire Transfer', result.action, result.violations, result.latency_ms);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Fortress: wire transfer check failed — ${extractErrorMessage(err)}`,
        );
    }
}

// ── Shared result display (used by all three validators) ─────────────

export async function showValidationResult(
    label: string,
    action: string,
    violations: Violation[],
    latencyMs: number,
): Promise<void> {
    const isBlocked = action.toLowerCase().includes('block') || action.toLowerCase() === 'deny';
    const icon = isBlocked ? '[BLOCKED]' : '[ALLOWED]';

    if (violations.length === 0) {
        vscode.window.showInformationMessage(
            `Fortress ${label}: ${icon} ${action}  (${latencyMs.toFixed(1)} ms — no violations)`,
        );
        return;
    }

    const summary = violations
        .map((v, i) => `${i + 1}. [${v.severity}] ${v.regulation} — ${v.description}`)
        .join('\n');

    const choice = await vscode.window.showWarningMessage(
        `Fortress ${label}: ${icon} ${action}  (${violations.length} violation${violations.length === 1 ? '' : 's'})`,
        'View Details',
        'Dismiss',
    );

    if (choice === 'View Details') {
        const content = buildViolationReport(label, action, violations, latencyMs);
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside,
        });
    }
}

function buildViolationReport(
    label: string,
    action: string,
    violations: Violation[],
    latencyMs: number,
): string {
    const lines: string[] = [
        `# Fortress ${label} — Compliance Report`,
        '',
        `**Action:** ${action}`,
        `**Latency:** ${latencyMs.toFixed(1)} ms`,
        `**Violations:** ${violations.length}`,
        '',
        '---',
        '',
    ];

    for (const v of violations) {
        lines.push(`## ${v.regulation} (${v.severity})`);
        lines.push(`**Rule ID:** ${v.rule_id}`);
        lines.push('');
        lines.push(v.description);
        lines.push('');
        lines.push(`**Recommendation:** ${v.recommendation}`);
        lines.push('');
        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
}
