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
exports.JiraPanel = void 0;
/**
 * JiraPanel — WebviewViewProvider for the "Generate Tests" sidebar panel.
 *
 * Renders a form where the user can enter a JIRA story and submit it to
 * Pipeline 2's POST /webhooks/jira endpoint. Shows live status updates as
 * the 6-agent pipeline runs and displays the final test code inline.
 */
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
class JiraPanel {
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._buildHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'submit') {
                await this._handleSubmit(msg.jiraKey, msg.summary, msg.description);
            }
        });
    }
    _post(msg) {
        this._view?.webview.postMessage(msg);
    }
    async _handleSubmit(jiraKey, summary, description) {
        const cfg = vscode.workspace.getConfiguration('fortress');
        const baseUrl = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
        const pollInterval = cfg.get('pollIntervalMs') ?? 3000;
        const pollTimeout = cfg.get('pollTimeoutMs') ?? 300000;
        const client = new client_1.Pipeline2Client(baseUrl);
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
            const result = await client.pollWorkflow(workflowId, pollInterval, pollTimeout, (update) => {
                const label = update.status === 'running'
                    ? agentLabels[step++ % agentLabels.length]
                    : `Status: ${update.status}`;
                this._post({ type: 'status', message: label, phase: update.status });
            });
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
                const testCode = artifacts['test_code'] ??
                    artifacts['generated_code'] ??
                    '';
                this._post({
                    type: 'done',
                    workflowId,
                    qualityScore: result.quality_score,
                    testCode,
                });
            }
            else {
                this._post({
                    type: 'error',
                    message: `Workflow ended with status: ${result.status}`,
                });
            }
        }
        catch (err) {
            this._post({ type: 'error', message: (0, client_1.extractErrorMessage)(err) });
        }
    }
    _buildHtml() {
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
exports.JiraPanel = JiraPanel;
JiraPanel.viewId = 'fortressJiraPanel';
//# sourceMappingURL=JiraPanel.js.map