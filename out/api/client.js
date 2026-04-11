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
exports.Pipeline2Client = void 0;
exports.extractErrorMessage = extractErrorMessage;
exports.clientFromConfig = clientFromConfig;
/**
 * Pipeline 2 API Client
 *
 * Talks directly to the Fortress Pipeline 2 FastAPI server running
 * inside the customer VPC (default: http://localhost:8000).
 *
 * No API key is needed — Pipeline 2 is secured by the VPC network
 * boundary, not application-layer auth.
 *
 * Endpoints covered:
 *   GET  /health/                          Health check
 *   GET  /health/ready                     Readiness check
 *   POST /webhooks/jira                    Trigger 6-agent pipeline from JIRA story
 *   GET  /workflows/{id}                   Workflow status + artifacts
 *   POST /approvals/                       Submit approval decision
 *   GET  /approvals/{workflow_id}          Pending approvals
 *   POST /validate/wire-transfer           BSA/AML wire transfer check
 *   POST /validate/ofac-screen             OFAC SDN sanctions screen
 *   POST /validate/loan-application        CFPB Section 1071 check
 */
const axios_1 = __importStar(require("axios"));
// ── Client ──────────────────────────────────────────────────────────
class Pipeline2Client {
    constructor(baseUrl) {
        this.http = axios_1.default.create({
            baseURL: baseUrl.replace(/\/$/, ''), // strip trailing slash
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        });
    }
    // ── Health ────────────────────────────────────────────────────────
    async health() {
        const res = await this.http.get('/health/');
        return res.data;
    }
    async ready() {
        const res = await this.http.get('/health/ready');
        return res.data;
    }
    async checkConnectivity() {
        try {
            await this.health();
            return true;
        }
        catch {
            return false;
        }
    }
    // ── Developer workflow ────────────────────────────────────────────
    /**
     * Submit a JIRA story to the 6-agent pipeline via POST /webhooks/jira.
     *
     * Pipeline 2 expects the standard JIRA webhook payload shape:
     *   { "issue": { "key": "BANK-123", "fields": { "summary": "...", "description": "..." } } }
     */
    async triggerWorkflow(jiraKey, summary, description) {
        const payload = {
            issue: {
                key: jiraKey,
                fields: {
                    summary,
                    description,
                },
            },
        };
        const res = await this.http.post('/webhooks/jira', payload);
        return res.data;
    }
    /** GET /workflows/{workflow_id} */
    async getWorkflow(workflowId) {
        const res = await this.http.get(`/workflows/${workflowId}`);
        return res.data;
    }
    /**
     * Poll GET /workflows/{workflow_id} until the workflow finishes or
     * the timeout elapses. Calls onProgress on each tick.
     */
    async pollWorkflow(workflowId, intervalMs, timeoutMs, onProgress) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const result = await this.getWorkflow(workflowId);
            onProgress(result);
            if (result.status === 'completed' || result.status === 'failed') {
                return result;
            }
            await sleep(intervalMs);
        }
        throw new Error(`Workflow ${workflowId} did not complete within ${timeoutMs / 1000}s`);
    }
    // ── Approvals ─────────────────────────────────────────────────────
    /** GET /approvals/{workflow_id} */
    async getPendingApprovals(workflowId) {
        const res = await this.http.get(`/approvals/${workflowId}`);
        return (res.data.approvals ?? []);
    }
    /**
     * POST /approvals/
     * decision: "approved" | "rejected"
     */
    async submitApproval(workflowId, checkpoint, decision) {
        const res = await this.http.post('/approvals/', {
            workflow_id: workflowId,
            checkpoint,
            decision,
        });
        return res.data;
    }
    // ── Production validation ─────────────────────────────────────────
    /** POST /validate/wire-transfer */
    async validateWireTransfer(req) {
        const res = await this.http.post('/validate/wire-transfer', req);
        return res.data;
    }
    /** POST /validate/ofac-screen */
    async screenOFAC(req) {
        const res = await this.http.post('/validate/ofac-screen', req);
        return res.data;
    }
    /** POST /validate/loan-application */
    async validateLoanApplication(req) {
        const res = await this.http.post('/validate/loan-application', req);
        return res.data;
    }
}
exports.Pipeline2Client = Pipeline2Client;
// ── Helpers ──────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/** Extract a human-readable message from an axios error. */
function extractErrorMessage(err) {
    if (err instanceof axios_1.AxiosError) {
        if (err.response) {
            const detail = err.response.data?.detail;
            return detail ?? `HTTP ${err.response.status}: ${err.response.statusText}`;
        }
        if (err.code === 'ECONNREFUSED') {
            return 'Cannot reach Pipeline 2 — is the server running and accessible?';
        }
        return err.message;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}
/** Build a Pipeline2Client from VS Code workspace configuration. */
function clientFromConfig() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    const cfg = vscode.workspace.getConfiguration('fortress');
    const url = cfg.get('pipeline2Url') ?? 'http://localhost:8000';
    return new Pipeline2Client(url);
}
//# sourceMappingURL=client.js.map