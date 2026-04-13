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
exports.WorkflowPanel = void 0;
/**
 * WorkflowPanel — WebviewViewProvider for the "Workflow Status" sidebar panel.
 *
 * Lets the user enter a workflow ID to look up its current state and view
 * artifacts / generated test code without leaving the sidebar.
 */
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
class WorkflowPanel {
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._buildHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'lookup') {
                await this._lookup(msg.workflowId);
            }
            else if (msg.type === 'approve') {
                await this._approve(msg.workflowId, msg.checkpoint, msg.decision);
            }
        });
    }
    _post(msg) {
        this._view?.webview.postMessage(msg);
    }
    async _lookup(workflowId) {
        const cfg = vscode.workspace.getConfiguration('fortress');
        const baseUrl = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
        const client = new client_1.Pipeline2Client(baseUrl);
        try {
            const result = await client.getWorkflow(workflowId);
            const approvals = result.status === 'waiting_approval'
                ? await client.getPendingApprovals(workflowId)
                : [];
            this._post({
                type: 'result',
                workflow: {
                    workflow_id: result.workflow_id,
                    jira_key: result.jira_key,
                    status: result.status,
                    quality_score: result.quality_score,
                    started_at: result.started_at,
                    completed_at: result.completed_at,
                    test_code: result.artifacts?.['test_code'] ??
                        result.artifacts?.['generated_code'] ??
                        '',
                    artifacts_json: JSON.stringify(result.artifacts ?? {}, null, 2),
                    approvals,
                },
            });
        }
        catch (err) {
            this._post({ type: 'error', message: (0, client_1.extractErrorMessage)(err) });
        }
    }
    async _approve(workflowId, checkpoint, decision) {
        const cfg = vscode.workspace.getConfiguration('fortress');
        const baseUrl = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
        const client = new client_1.Pipeline2Client(baseUrl);
        try {
            const resp = await client.submitApproval(workflowId, checkpoint, decision);
            this._post({ type: 'approvalDone', status: resp.status, decision });
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
  input {
    width: 100%; box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 6px; margin-top: 3px;
  }
  button {
    margin-top: 8px; padding: 5px 10px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  #result { margin-top: 12px; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 3px 6px; border-bottom: 1px solid var(--vscode-editorWidget-border); }
  td:first-child { font-weight: bold; width: 40%; }
  .status-completed { color: var(--vscode-testing-iconPassed); }
  .status-failed { color: var(--vscode-testing-iconFailed); }
  .status-running { color: var(--vscode-charts-yellow); }
  #testCode {
    margin-top: 10px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-input-border);
    padding: 8px; white-space: pre; overflow: auto;
    max-height: 250px; font-family: monospace; font-size: 11px;
    display: none;
  }
  .err { color: var(--vscode-errorForeground); margin-top: 8px; }
  #approvalSection { display: none; margin-top: 10px; }
</style>
</head>
<body>
<h2>Workflow Status</h2>

<label for="wfId">Workflow ID</label>
<input id="wfId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
<button onclick="lookup()">Look Up</button>

<div id="result"></div>
<div id="approvalSection">
  <strong>Approval required:</strong> <span id="checkpointLabel"></span><br>
  <button onclick="sendApproval('approved')">Approve</button>
  <button class="secondary" onclick="sendApproval('rejected')">Reject</button>
</div>
<pre id="testCode"></pre>
<div id="err" class="err"></div>

<script>
const vscode = acquireVsCodeApi();
let currentWorkflowId = '';
let currentCheckpoint = '';

function lookup() {
  const id = document.getElementById('wfId').value.trim();
  if (!id) { return; }
  currentWorkflowId = id;
  document.getElementById('result').innerHTML = 'Loading…';
  document.getElementById('approvalSection').style.display = 'none';
  document.getElementById('testCode').style.display = 'none';
  document.getElementById('err').textContent = '';
  vscode.postMessage({ type: 'lookup', workflowId: id });
}

function sendApproval(decision) {
  vscode.postMessage({ type: 'approve', workflowId: currentWorkflowId, checkpoint: currentCheckpoint, decision });
}

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'result') {
    const w = msg.workflow;
    const cls = 'status-' + w.status;
    document.getElementById('result').innerHTML =
      '<table>' +
      row('JIRA Key', w.jira_key) +
      row('Status', '<span class="' + cls + '">' + w.status + '</span>') +
      row('Quality', w.quality_score) +
      row('Started', w.started_at || 'n/a') +
      row('Completed', w.completed_at || 'n/a') +
      '</table>';

    if (w.status === 'waiting_approval' && w.approvals && w.approvals.length > 0) {
      currentCheckpoint = w.approvals[0].checkpoint;
      document.getElementById('checkpointLabel').textContent = currentCheckpoint;
      document.getElementById('approvalSection').style.display = 'block';
    }

    if (w.test_code) {
      const pre = document.getElementById('testCode');
      pre.textContent = w.test_code;
      pre.style.display = 'block';
    }
  } else if (msg.type === 'approvalDone') {
    document.getElementById('approvalSection').style.display = 'none';
    document.getElementById('result').innerHTML += '<p>' + msg.decision + ' submitted.</p>';
    lookup(); // refresh
  } else if (msg.type === 'error') {
    document.getElementById('err').textContent = msg.message;
    document.getElementById('result').innerHTML = '';
  }
});

function row(k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; }
</script>
</body>
</html>`;
    }
}
exports.WorkflowPanel = WorkflowPanel;
WorkflowPanel.viewId = 'fortressWorkflowPanel';
//# sourceMappingURL=WorkflowPanel.js.map