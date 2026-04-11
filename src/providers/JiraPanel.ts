/**
 * JiraPanel — WebviewViewProvider for the "Generate Tests" sidebar panel.
 *
 * Renders a form where the user can enter a JIRA story and submit it to
 * Pipeline 2's POST /webhooks/jira endpoint. Shows live status updates as
 * the 6-agent pipeline runs and displays the final test code inline.
 */
import * as vscode from 'vscode';
import { Pipeline2Client, WorkflowResult, extractErrorMessage } from '../api/client';

export class JiraPanel implements vscode.WebviewViewProvider {
    public static readonly viewId = 'fortressJiraPanel';
    private _view?: vscode.WebviewView;

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._buildHtml();

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'submit') {
                await this._handleSubmit(
                    msg.jiraKey,
                    msg.summary,
                    msg.description,
                );
            }
        });
    }

    private _post(msg: Record<string, unknown>): void {
        this._view?.webview.postMessage(msg);
    }

    private async _handleSubmit(
        jiraKey: string,
        summary: string,
        description: string,
    ): Promise<void> {
        const cfg = vscode.workspace.getConfiguration('fortress');
        const baseUrl: string = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
        const pollInterval: number = cfg.get('pollIntervalMs') ?? 3000;
        const pollTimeout: number = cfg.get('pollTimeoutMs') ?? 300000;

        const client = new Pipeline2Client(baseUrl);

        try {
            this._post({ type: 'status', message: 'Submitting to Pipeline 2…', phase: 'running' });

            const trigger = await client.triggerWorkflow(jiraKey, summary, description);
            const workflowId = trigger.workflow_id;

            const agentLabels = [
                'Discovery agent analysing story…',
                'Understanding agent building semantic model…',
                'Framework agent selecting test strategy…',
                'Generation agent writing pytest code…',
                'Validation agent checking compliance rules…',
                'Execution agent running tests…',
            ];
            let step = 0;

            const result: WorkflowResult = await client.pollWorkflow(
                workflowId,
                pollInterval,
                pollTimeout,
                (update) => {
                    const label =
                        update.status === 'running'
                            ? agentLabels[step++ % agentLabels.length]
                            : `Status: ${update.status}`;
                    this._post({ type: 'status', message: label, phase: update.status });
                },
            );

            if (result.status === 'waiting_approval') {
                this._post({
                    type: 'approval',
                    workflowId,
                    message: 'Workflow is waiting for approval.',
                });
                return;
            }

            if (result.status === 'completed') {
                const artifacts = result.artifacts ?? {};
                const testCode =
                    (artifacts['test_code'] as string | undefined) ??
                    (artifacts['generated_code'] as string | undefined) ??
                    '';

                this._post({
                    type: 'done',
                    workflowId,
                    qualityScore: result.quality_score,
                    testCode,
                });
            } else {
                this._post({
                    type: 'error',
                    message: `Workflow ended with status: ${result.status}`,
                });
            }
        } catch (err) {
            this._post({ type: 'error', message: extractErrorMessage(err) });
        }
    }

    private _buildHtml(): string {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: var(--vscode-font-family); font-size: 13px; padding: 12px; color: var(--vscode-foreground); }
  h2 { font-size: 14px; margin-bottom: 10px; }
  label { display: block; margin-top: 8px; font-weight: bold; }
  input, textarea {
    width: 100%; box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 6px; margin-top: 3px;
  }
  textarea { height: 100px; resize: vertical; }
  button {
    margin-top: 12px; width: 100%; padding: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  #status { margin-top: 10px; font-style: italic; min-height: 18px; }
  #testCode {
    margin-top: 12px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-input-border);
    padding: 8px; white-space: pre; overflow: auto;
    max-height: 300px; font-family: monospace; font-size: 11px;
    display: none;
  }
  .err { color: var(--vscode-errorForeground); }
  .ok  { color: var(--vscode-testing-iconPassed); }
</style>
</head>
<body>
<h2>Generate Tests from JIRA Story</h2>

<label for="jiraKey">JIRA Key</label>
<input id="jiraKey" placeholder="BANK-456" />

<label for="summary">Summary</label>
<input id="summary" placeholder="Wire transfer must screen OFAC SDN list" />

<label for="description">Description / Acceptance Criteria</label>
<textarea id="description" placeholder="As a compliance officer, I need all wire transfers over $10,000 to be screened against the OFAC SDN list…"></textarea>

<button id="submitBtn" onclick="submit()">Run 6-Agent Pipeline</button>

<div id="status"></div>
<pre id="testCode"></pre>

<script>
const vscode = acquireVsCodeApi();

function submit() {
  const jiraKey = document.getElementById('jiraKey').value.trim();
  const summary = document.getElementById('summary').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!/^[A-Z]+-\\d+$/.test(jiraKey)) {
    setStatus('Invalid JIRA key format (e.g. BANK-456)', 'err');
    return;
  }
  if (summary.length < 10) {
    setStatus('Summary too short (min 10 chars)', 'err');
    return;
  }
  if (description.length < 20) {
    setStatus('Description too short (min 20 chars)', 'err');
    return;
  }

  document.getElementById('submitBtn').disabled = true;
  document.getElementById('testCode').style.display = 'none';
  setStatus('Sending to Pipeline 2…', '');

  vscode.postMessage({ type: 'submit', jiraKey, summary, description });
}

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'status') {
    setStatus(msg.message, '');
  } else if (msg.type === 'done') {
    setStatus('Done! Quality score: ' + msg.qualityScore, 'ok');
    const pre = document.getElementById('testCode');
    pre.textContent = msg.testCode || '(no test code in artifacts)';
    pre.style.display = 'block';
    document.getElementById('submitBtn').disabled = false;
  } else if (msg.type === 'error') {
    setStatus('Error: ' + msg.message, 'err');
    document.getElementById('submitBtn').disabled = false;
  } else if (msg.type === 'approval') {
    setStatus('Waiting for approval (workflow: ' + msg.workflowId + ')', '');
    document.getElementById('submitBtn').disabled = false;
  }
});

function setStatus(text, cls) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = cls || '';
}
</script>
</body>
</html>`;
    }
}
