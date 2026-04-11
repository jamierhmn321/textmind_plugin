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
exports.validateOFACCommand = validateOFACCommand;
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
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
const validateWireTransfer_1 = require("./validateWireTransfer");
async function validateOFACCommand() {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl = cfg.get('pipeline2Url') ?? 'http://localhost:8000';
    const partyName = await vscode.window.showInputBox({
        title: 'Fortress — OFAC Sanctions Screen',
        prompt: 'Party name to screen (individual or entity)',
        placeHolder: 'Acme Trading LLC',
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length >= 2 ? null : 'Please enter at least 2 characters',
    });
    if (!partyName) {
        return;
    }
    const partyCountry = await vscode.window.showInputBox({
        title: 'Fortress — OFAC Sanctions Screen',
        prompt: 'Party country code (2-letter ISO, optional)',
        placeHolder: 'IR',
        ignoreFocusOut: true,
        validateInput: (v) => v === '' || /^[A-Z]{2}$/i.test(v.trim()) ? null : 'Use 2-letter ISO country code',
    });
    if (partyCountry === undefined) {
        return;
    }
    try {
        const client = new client_1.Pipeline2Client(baseUrl);
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fortress: screening "${partyName}" against OFAC SDN list…`,
            cancellable: false,
        }, () => client.screenOFAC({
            party_name: partyName.trim(),
            party_country: partyCountry.trim().toUpperCase() || undefined,
        }));
        await (0, validateWireTransfer_1.showValidationResult)('OFAC Screen', result.action, result.violations, result.latency_ms);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Fortress: OFAC screen failed — ${(0, client_1.extractErrorMessage)(err)}`);
    }
}
//# sourceMappingURL=validateOFAC.js.map