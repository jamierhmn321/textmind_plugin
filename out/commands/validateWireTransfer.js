"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWireTransferCommand = validateWireTransferCommand;
exports.showValidationResult = showValidationResult;
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
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
async function validateWireTransferCommand() {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
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
    if (!amountStr) {
        return;
    }
    const senderName = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Sender full name',
        placeHolder: 'John Smith',
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length >= 2 ? null : 'Name too short',
    });
    if (!senderName) {
        return;
    }
    const beneficiaryName = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Beneficiary full name',
        placeHolder: 'Acme Corp',
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length >= 2 ? null : 'Name too short',
    });
    if (!beneficiaryName) {
        return;
    }
    const beneficiaryCountry = await vscode.window.showInputBox({
        title: 'Fortress — Wire Transfer Validation',
        prompt: 'Beneficiary country code (2-letter ISO, leave blank for US)',
        placeHolder: 'US',
        value: 'US',
        ignoreFocusOut: true,
        validateInput: (v) => v === '' || /^[A-Z]{2}$/i.test(v.trim()) ? null : 'Use 2-letter ISO country code (e.g. US, GB)',
    });
    if (beneficiaryCountry === undefined) {
        return;
    }
    const isIntl = beneficiaryCountry.toUpperCase() !== 'US' && beneficiaryCountry !== '';
    // ── Call API ──────────────────────────────────────────────────────
    try {
        const client = new client_1.Pipeline2Client(baseUrl);
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fortress: running wire transfer compliance check…',
            cancellable: false,
        }, () => client.validateWireTransfer({
            amount: parseFloat(amountStr),
            currency: 'USD',
            sender_name: senderName.trim(),
            beneficiary_name: beneficiaryName.trim(),
            beneficiary_country: (beneficiaryCountry || 'US').toUpperCase(),
            is_international: isIntl,
        }));
        await showValidationResult('Wire Transfer', result.action, result.violations, result.latency_ms);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Fortress: wire transfer check failed — ${(0, client_1.extractErrorMessage)(err)}`);
    }
}
// ── Shared result display (used by all three validators) ─────────────
async function showValidationResult(label, action, violations, latencyMs) {
    const isBlocked = action.toLowerCase().includes('block') || action.toLowerCase() === 'deny';
    const icon = isBlocked ? '[BLOCKED]' : '[ALLOWED]';
    if (violations.length === 0) {
        vscode.window.showInformationMessage(`Fortress ${label}: ${icon} ${action}  (${latencyMs.toFixed(1)} ms — no violations)`);
        return;
    }
    const summary = violations
        .map((v, i) => `${i + 1}. [${v.severity}] ${v.regulation} — ${v.description}`)
        .join('\n');
    const choice = await vscode.window.showWarningMessage(`Fortress ${label}: ${icon} ${action}  (${violations.length} violation${violations.length === 1 ? '' : 's'})`, 'View Details', 'Dismiss');
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
function buildViolationReport(label, action, violations, latencyMs) {
    const lines = [
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
//# sourceMappingURL=validateWireTransfer.js.map