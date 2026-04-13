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
exports.checkHealthCommand = checkHealthCommand;
/**
 * Health check command — verifies that Pipeline 2 is reachable and ready.
 * Calls GET /health/ and GET /health/ready.
 */
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
async function checkHealthCommand() {
    const cfg = vscode.workspace.getConfiguration('fortress');
    const baseUrl = cfg.get('pipeline2Url') ?? 'http://fortress_api:8000';
    try {
        const client = new client_1.Pipeline2Client(baseUrl);
        const [healthResult, readyResult] = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fortress: checking Pipeline 2 at ${baseUrl}…`,
            cancellable: false,
        }, async () => {
            const h = await client.health();
            const r = await client.ready();
            return [h, r];
        });
        const deps = [
            `postgres: ${readyResult.postgres ? 'ok' : 'DOWN'}`,
            `redis: ${readyResult.redis ? 'ok' : 'DOWN'}`,
            `weaviate: ${readyResult.weaviate ? 'ok' : 'DOWN'}`,
        ].join('  ');
        if (readyResult.ready) {
            vscode.window.showInformationMessage(`Fortress Pipeline 2 — healthy\n` +
                `Service: ${healthResult.service}  ${deps}\n` +
                `URL: ${baseUrl}`);
        }
        else {
            vscode.window.showWarningMessage(`Fortress Pipeline 2 — not ready\n` +
                `Service: ${healthResult.service}  ${deps}\n` +
                `URL: ${baseUrl}`);
        }
    }
    catch (err) {
        const msg = (0, client_1.extractErrorMessage)(err);
        const configure = await vscode.window.showErrorMessage(`Fortress: Pipeline 2 not reachable at ${baseUrl} — ${msg}`, 'Configure URL');
        if (configure === 'Configure URL') {
            vscode.commands.executeCommand('fortress.configure');
        }
    }
}
//# sourceMappingURL=health.js.map