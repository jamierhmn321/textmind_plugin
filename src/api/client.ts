import axios, { AxiosInstance } from 'axios';

export interface WorkflowResponse {
    id: string;
    status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed';
    scenarios?: TestScenario[];
    test_code?: string;
    results?: any;
}

export interface TestScenario {
    title: string;
    gherkin: string;
    approved: boolean;
}

export interface UsageStats {
    api_calls_this_month: number;
    api_calls_included: number;
    api_calls_overage: number;
    estimated_cost: number;
    billing_tier: string;
}

export class TextMindClient {
    private client: AxiosInstance;
    
    constructor(apiKey: string, baseUrl: string = 'https://api.textmind.ai/v1') {
        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 300000 // 5 minutes
        });
    }
    
    async generateTests(jiraStoryKey: string): Promise<WorkflowResponse> {
        const response = await this.client.post('/workflows/trigger', {
            jira_story_key: jiraStoryKey
        });
        return response.data;
    }
    
    async getWorkflowStatus(workflowId: string): Promise<WorkflowResponse> {
        const response = await this.client.get(`/workflows/${workflowId}`);
        return response.data;
    }
    
    async approveScenarios(
        workflowId: string, 
        decision: 'approved' | 'rejected',
        feedback?: string
    ): Promise<WorkflowResponse> {
        const response = await this.client.post(`/approvals/${workflowId}`, {
            checkpoint: 'scenarios',
            decision,
            feedback
        });
        return response.data;
    }
    
    async getUsageStats(): Promise<UsageStats> {
        const response = await this.client.get('/usage/current-month');
        return response.data;
    }
    
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.client.get('/health');
            return response.status === 200;
        } catch {
            return false;
        }
    }
}
