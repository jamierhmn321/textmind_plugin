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
exports.validateLoanCommand = validateLoanCommand;
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
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
const validateWireTransfer_1 = require("./validateWireTransfer");
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
async function validateLoanCommand() {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl = cfg.get('pipeline2Url') ?? 'http://localhost:8000';
    // ── Collect CFPB Section 1071 demographic fields ──────────────────
    const race = await vscode.window.showQuickPick(RACE_OPTIONS, {
        title: 'Fortress — Loan Validation (CFPB Section 1071)',
        placeHolder: 'Race of principal owner',
        ignoreFocusOut: true,
    });
    if (!race) {
        return;
    }
    const sex = await vscode.window.showQuickPick(SEX_OPTIONS, {
        title: 'Fortress — Loan Validation (CFPB Section 1071)',
        placeHolder: 'Sex of principal owner',
        ignoreFocusOut: true,
    });
    if (!sex) {
        return;
    }
    const ethnicity = await vscode.window.showQuickPick(ETHNICITY_OPTIONS, {
        title: 'Fortress — Loan Validation (CFPB Section 1071)',
        placeHolder: 'Ethnicity of principal owner',
        ignoreFocusOut: true,
    });
    if (!ethnicity) {
        return;
    }
    const naicsCode = await vscode.window.showInputBox({
        title: 'Fortress — Loan Validation',
        prompt: 'NAICS code (6-digit industry classification)',
        placeHolder: '522110',
        ignoreFocusOut: true,
        validateInput: (v) => v === '' || /^\d{6}$/.test(v.trim()) ? null : 'NAICS code must be exactly 6 digits',
    });
    if (naicsCode === undefined) {
        return;
    }
    const revenueStr = await vscode.window.showInputBox({
        title: 'Fortress — Loan Validation',
        prompt: 'Business gross annual revenue (USD)',
        placeHolder: '2500000',
        ignoreFocusOut: true,
        validateInput: (v) => {
            if (v === '') {
                return null;
            }
            const n = parseFloat(v);
            return !isNaN(n) && n >= 0 ? null : 'Enter a non-negative number';
        },
    });
    if (revenueStr === undefined) {
        return;
    }
    const workersStr = await vscode.window.showInputBox({
        title: 'Fortress — Loan Validation',
        prompt: 'Number of workers (full-time equivalent)',
        placeHolder: '12',
        ignoreFocusOut: true,
        validateInput: (v) => {
            if (v === '') {
                return null;
            }
            const n = parseInt(v, 10);
            return !isNaN(n) && n >= 0 ? null : 'Enter a non-negative integer';
        },
    });
    if (workersStr === undefined) {
        return;
    }
    // ── Build request ─────────────────────────────────────────────────
    const req = {
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
        const client = new client_1.Pipeline2Client(baseUrl);
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fortress: running CFPB Section 1071 loan compliance check…',
            cancellable: false,
        }, () => client.validateLoanApplication(req));
        await (0, validateWireTransfer_1.showValidationResult)('Loan (Section 1071)', result.action, result.violations, result.latency_ms);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Fortress: loan validation failed — ${(0, client_1.extractErrorMessage)(err)}`);
    }
}
//# sourceMappingURL=validateLoan.js.map