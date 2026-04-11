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
exports.configureCommand = configureCommand;
/**
 * Configure command — lets the user set (and validate) the Pipeline 2 URL.
 *
 * Pipeline 2 runs inside the customer VPC with no application-layer auth,
 * so all we need is the base URL (e.g. http://localhost:8000 or
 * https://fortress-pipeline2.internal).
 */
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
async function configureCommand() {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const current = cfg.get('pipeline2Url') ?? 'http://localhost:8000';
    const url = await vscode.window.showInputBox({
        title: 'Fortress — Configure Pipeline 2',
        prompt: 'Enter the base URL of your Pipeline 2 server (running inside your VPC)',
        placeHolder: 'http://localhost:8000',
        value: current,
        ignoreFocusOut: true,
        validateInput: (value) => {
            try {
                new URL(value);
                return null;
            }
            catch {
                return 'Please enter a valid URL (e.g. http://localhost:8000)';
            }
        },
    });
    if (!url) {
        return; // user cancelled
    }
    // Test connectivity before saving
    const reachable = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fortress: checking Pipeline 2 connection…',
        cancellable: false,
    }, async () => {
        try {
            const client = new client_1.Pipeline2Client(url);
            return await client.checkConnectivity();
        }
        catch {
            return false;
        }
    });
    if (!reachable) {
        const choice = await vscode.window.showWarningMessage(`Could not reach Pipeline 2 at ${url}. Save anyway?`, 'Save Anyway', 'Cancel');
        if (choice !== 'Save Anyway') {
            return;
        }
    }
    await cfg.update('pipeline2Url', url, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Fortress: Pipeline 2 URL saved → ${url}`);
}
//# sourceMappingURL=configure.js.map