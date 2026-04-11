/**
 * Validate Loan Application command
 *
 * Calls Pipeline 2's POST /validate/loan-application endpoint, which runs the
 * LoanApplicationValidator for CFPB Section 1071 small-business lending
 * compliance (no applicant data leaves the VPC).
 *
 * Checks performed by Pipeline 2:
 *   - Required demographic field collection (race, sex, ethnicity)
 *   - Firewall rule — underwriter must not see demographic data
 *   - NAICS code presence
 *   - Business gross revenue collection
 */
import * as vscode from 'vscode';
import { Pipeline2Client, LoanApplicationRequest, extractErrorMessage } from '../api/client';
import { showValidationResult } from './validateWireTransfer';

const RACE_OPTIONS = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Not Provided',
    'Not Applicable',
];

const SEX_OPTIONS = [
    'Male',
    'Female',
    'Non-binary',
    'Not Provided',
    'Not Applicable',
];

const ETHNICITY_OPTIONS = [
    'Hispanic or Latino',
    'Not Hispanic or Latino',
    'Not Provided',
    'Not Applicable',
];

export async function validateLoanCommand(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';

    // ── Collect CFPB Section 1071 demographic fields ──────────────────
    const race = await vscode.window.showQuickPick(RACE_OPTIONS, {
        title: 'Fortress — Loan Validation (CFPB Section 1071)',
        placeHolder: 'Race of principal owner',
        ignoreFocusOut: true,
    });
    if (!race) { return; }

    const sex = await vscode.window.showQuickPick(SEX_OPTIONS, {
        title: 'Fortress — Loan Validation (CFPB Section 1071)',
        placeHolder: 'Sex of principal owner',
        ignoreFocusOut: true,
    });
    if (!sex) { return; }

    const ethnicity = await vscode.window.showQuickPick(ETHNICITY_OPTIONS, {
        title: 'Fortress — Loan Validation (CFPB Section 1071)',
        placeHolder: 'Ethnicity of principal owner',
        ignoreFocusOut: true,
    });
    if (!ethnicity) { return; }

    const naicsCode = await vscode.window.showInputBox({
        title: 'Fortress — Loan Validation',
        prompt: 'NAICS code (6-digit industry classification)',
        placeHolder: '522110',
        ignoreFocusOut: true,
        validateInput: (v) =>
            v === '' || /^\d{6}$/.test(v.trim()) ? null : 'NAICS code must be exactly 6 digits',
    });
    if (naicsCode === undefined) { return; }

    const revenueStr = await vscode.window.showInputBox({
        title: 'Fortress — Loan Validation',
        prompt: 'Business gross annual revenue (USD)',
        placeHolder: '2500000',
        ignoreFocusOut: true,
        validateInput: (v) => {
            if (v === '') { return null; }
            const n = parseFloat(v);
            return !isNaN(n) && n >= 0 ? null : 'Enter a non-negative number';
        },
    });
    if (revenueStr === undefined) { return; }

    const workersStr = await vscode.window.showInputBox({
        title: 'Fortress — Loan Validation',
        prompt: 'Number of workers (full-time equivalent)',
        placeHolder: '12',
        ignoreFocusOut: true,
        validateInput: (v) => {
            if (v === '') { return null; }
            const n = parseInt(v, 10);
            return !isNaN(n) && n >= 0 ? null : 'Enter a non-negative integer';
        },
    });
    if (workersStr === undefined) { return; }

    // ── Build request ─────────────────────────────────────────────────
    const req: LoanApplicationRequest = {
        race_of_principal_owner: race,
        sex_of_principal_owner: sex,
        ethnicity_of_principal_owner: ethnicity,
    };

    if (naicsCode.trim()) {
        req.naics_code = naicsCode.trim();
    }
    if (revenueStr.trim()) {
        req.business_gross_revenue = parseFloat(revenueStr);
    }
    if (workersStr.trim()) {
        req.number_of_workers = parseInt(workersStr, 10);
    }

    // ── Call API ──────────────────────────────────────────────────────
    try {
        const client = new Pipeline2Client(baseUrl);

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fortress: running CFPB Section 1071 loan compliance check…',
                cancellable: false,
            },
            () => client.validateLoanApplication(req),
        );

        await showValidationResult('Loan (Section 1071)', result.action, result.violations, result.latency_ms);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Fortress: loan validation failed — ${extractErrorMessage(err)}`,
        );
    }
}
