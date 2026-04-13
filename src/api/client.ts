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
import axios, { AxiosInstance, AxiosError } from 'axios';

// ── Workflow types ──────────────────────────────────────────────────

export type WorkflowStatus =
    | 'pending'
    | 'running'
    | 'waiting_approval'
    | 'completed'
    | 'failed';

export interface TriggerResponse {
    status: 'processing';
    workflow_id: string;
    jira_key: string;
}

export interface WorkflowResult {
    workflow_id: string;
    jira_key: string;
    status: WorkflowStatus;
    started_at: string | null;
    completed_at: string | null;
    artifacts: Record<string, unknown>;
    quality_score: number;
}

export interface PendingApproval {
    id: string;
    checkpoint: string;
    created_at: string;
}

export interface ApprovalResponse {
    status: string;
}

// ── Validation types ────────────────────────────────────────────────

export interface Violation {
    regulation: string;
    rule_id: string;
    description: string;
    severity: string;
    recommendation: string;
}

export interface ValidationResult {
    action: string;
    violations: Violation[];
    screening_timestamp: string;
    latency_ms: number;
}

// Wire transfer request (POST /validate/wire-transfer)
export interface WireTransferRequest {
    amount: number;
    currency?: string;            // default: "USD"
    sender_name: string;
    beneficiary_name: string;
    beneficiary_country?: string; // default: "US"
    is_international?: boolean;   // default: false
    approvals?: { role: string; name: string }[];
}

// OFAC screen request (POST /validate/ofac-screen)
export interface OFACScreenRequest {
    party_name: string;
    party_country?: string;
}

// Loan application request (POST /validate/loan-application)
export interface LoanApplicationRequest {
    race_of_principal_owner?: string;
    sex_of_principal_owner?: string;
    ethnicity_of_principal_owner?: string;
    naics_code?: string;
    business_gross_revenue?: number;
    time_in_business?: string;
    number_of_workers?: number;
    minority_owned_business?: boolean;
    women_owned_business?: boolean;
}

// ── Client ──────────────────────────────────────────────────────────

export class Pipeline2Client {
    private http: AxiosInstance;

    constructor(baseUrl: string, apiKey?: string) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }
        this.http = axios.create({
            baseURL: baseUrl.replace(/\/$/, ''), // strip trailing slash
            headers,
            timeout: 30_000,
        });
    }

    // ── Health ────────────────────────────────────────────────────────

    async health(): Promise<{ status: string; service: string }> {
        const res = await this.http.get('/health/');
        return res.data;
    }

    async ready(): Promise<{ ready: boolean; postgres: boolean; redis: boolean; weaviate: boolean }> {
        const res = await this.http.get('/health/ready');
        return res.data;
    }

    async checkConnectivity(): Promise<boolean> {
        try {
            await this.health();
            return true;
        } catch {
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
    async triggerWorkflow(
        jiraKey: string,
        summary: string,
        description: string,
    ): Promise<TriggerResponse> {
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
        return res.data as TriggerResponse;
    }

    /** GET /workflows/{workflow_id} */
    async getWorkflow(workflowId: string): Promise<WorkflowResult> {
        const res = await this.http.get(`/workflows/${workflowId}`);
        return res.data as WorkflowResult;
    }

    /**
     * Poll GET /workflows/{workflow_id} until the workflow finishes or
     * the timeout elapses. Calls onProgress on each tick.
     */
    async pollWorkflow(
        workflowId: string,
        intervalMs: number,
        timeoutMs: number,
        onProgress: (result: WorkflowResult) => void,
    ): Promise<WorkflowResult> {
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
    async getPendingApprovals(workflowId: string): Promise<PendingApproval[]> {
        const res = await this.http.get(`/approvals/${workflowId}`);
        return (res.data.approvals ?? []) as PendingApproval[];
    }

    /**
     * POST /approvals/
     * decision: "approved" | "rejected"
     */
    async submitApproval(
        workflowId: string,
        checkpoint: string,
        decision: 'approved' | 'rejected',
    ): Promise<ApprovalResponse> {
        const res = await this.http.post('/approvals/', {
            workflow_id: workflowId,
            checkpoint,
            decision,
        });
        return res.data as ApprovalResponse;
    }

    // ── Production validation ─────────────────────────────────────────

    /** POST /validate/wire-transfer */
    async validateWireTransfer(req: WireTransferRequest): Promise<ValidationResult> {
        const res = await this.http.post('/validate/wire-transfer', req);
        return res.data as ValidationResult;
    }

    /** POST /validate/ofac-screen */
    async screenOFAC(req: OFACScreenRequest): Promise<ValidationResult> {
        const res = await this.http.post('/validate/ofac-screen', req);
        return res.data as ValidationResult;
    }

    /** POST /validate/loan-application */
    async validateLoanApplication(req: LoanApplicationRequest): Promise<ValidationResult> {
        const res = await this.http.post('/validate/loan-application', req);
        return res.data as ValidationResult;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Extract a human-readable message from an axios error. */
export function extractErrorMessage(err: unknown): string {
    if (err instanceof AxiosError) {
        if (err.response) {
            const detail = (err.response.data as { detail?: string })?.detail;
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
export function clientFromConfig(): Pipeline2Client {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    const cfg = vscode.workspace.getConfiguration('fortress');
    const url: string = cfg.get('pipeline2Url') ?? 'http://fortress_api:8000';
    const apiKey: string | undefined = cfg.get('apiKey') || undefined;
    return new Pipeline2Client(url, apiKey);
}
