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
exports.ValidationPanel = void 0;
/**
 * ValidationPanel — WebviewViewProvider for the "Compliance Validation" sidebar panel.
 *
 * Provides a tabbed UI for all three Pipeline 2 production validators:
 *   - Wire Transfer (POST /validate/wire-transfer)
 *   - OFAC Screen   (POST /validate/ofac-screen)
 *   - Loan App      (POST /validate/loan-application)
 */
const vscode = __importStar(require("vscode"));
const client_1 = require("../api/client");
class ValidationPanel {
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._buildHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            const cfg = vscode.workspace.getConfiguration('fortress');
            const baseUrl = cfg.get('pipeline2Url') ?? 'http://54.174.78.213:8000';
            const client = new client_1.Pipeline2Client(baseUrl);
            try {
                if (msg.type === 'wireTransfer') {
                    const result = await client.validateWireTransfer(msg.payload);
                    this._post({ type: 'result', label: 'Wire Transfer', ...result });
                }
                else if (msg.type === 'ofacScreen') {
                    const result = await client.screenOFAC(msg.payload);
                    this._post({ type: 'result', label: 'OFAC Screen', ...result });
                }
                else if (msg.type === 'loanApp') {
                    const result = await client.validateLoanApplication(msg.payload);
                    this._post({ type: 'result', label: 'Loan Application', ...result });
                }
            }
            catch (err) {
                this._post({ type: 'error', message: (0, client_1.extractErrorMessage)(err) });
            }
        });
    }
    _post(msg) {
        this._view?.webview.postMessage(msg);
    }
    _buildHtml() {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: var(--vscode-font-family); font-size: 12px; padding: 10px; color: var(--vscode-foreground); }
  h2 { font-size: 14px; margin-bottom: 8px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 10px; }
  .tab {
    padding: 4px 10px; cursor: pointer;
    border: 1px solid var(--vscode-input-border);
    background: var(--vscode-editor-background);
  }
  .tab.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: transparent;
  }
  .panel { display: none; }
  .panel.active { display: block; }
  label { display: block; margin-top: 6px; font-weight: bold; }
  input, select, textarea {
    width: 100%; box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 3px 5px; margin-top: 2px;
  }
  button {
    margin-top: 10px; width: 100%; padding: 5px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  #result { margin-top: 12px; }
  .action-allow { color: var(--vscode-testing-iconPassed); font-weight: bold; }
  .action-block { color: var(--vscode-testing-iconFailed); font-weight: bold; }
  .violation { margin-top: 8px; padding: 6px; border-left: 3px solid var(--vscode-charts-yellow); }
  .violation-critical { border-left-color: var(--vscode-testing-iconFailed); }
  .err { color: var(--vscode-errorForeground); margin-top: 8px; }
</style>
</head>
<body>
<h2>Compliance Validation</h2>

<div class="tabs">
  <div class="tab active" onclick="switchTab('wire')">Wire Transfer</div>
  <div class="tab" onclick="switchTab('ofac')">OFAC</div>
  <div class="tab" onclick="switchTab('loan')">Loan (1071)</div>
</div>

<!-- Wire Transfer Panel -->
<div id="wirePanel" class="panel active">
  <label>Amount (USD)</label>
  <input id="w_amount" type="number" placeholder="15000" />
  <label>Sender Name</label>
  <input id="w_sender" placeholder="John Smith" />
  <label>Beneficiary Name</label>
  <input id="w_bene" placeholder="Acme Corp" />
  <label>Beneficiary Country (ISO 2)</label>
  <input id="w_country" placeholder="US" value="US" maxlength="2" />
  <button onclick="submitWire()">Validate Wire Transfer</button>
</div>

<!-- OFAC Panel -->
<div id="ofacPanel" class="panel">
  <label>Party Name</label>
  <input id="o_name" placeholder="Acme Trading LLC" />
  <label>Party Country (ISO 2, optional)</label>
  <input id="o_country" placeholder="IR" maxlength="2" />
  <button onclick="submitOFAC()">Screen Against OFAC SDN</button>
</div>

<!-- Loan Panel -->
<div id="loanPanel" class="panel">
  <label>Race of Principal Owner</label>
  <select id="l_race">
    <option>Not Provided</option>
    <option>American Indian or Alaska Native</option>
    <option>Asian</option>
    <option>Black or African American</option>
    <option>Native Hawaiian or Other Pacific Islander</option>
    <option>White</option>
    <option>Not Applicable</option>
  </select>
  <label>Sex of Principal Owner</label>
  <select id="l_sex">
    <option>Not Provided</option>
    <option>Male</option>
    <option>Female</option>
    <option>Non-binary</option>
    <option>Not Applicable</option>
  </select>
  <label>Ethnicity of Principal Owner</label>
  <select id="l_ethnicity">
    <option>Not Provided</option>
    <option>Hispanic or Latino</option>
    <option>Not Hispanic or Latino</option>
    <option>Not Applicable</option>
  </select>
  <label>NAICS Code (6 digits, optional)</label>
  <input id="l_naics" placeholder="522110" maxlength="6" />
  <label>Gross Annual Revenue (USD, optional)</label>
  <input id="l_revenue" type="number" placeholder="2500000" />
  <label>Number of Workers (optional)</label>
  <input id="l_workers" type="number" placeholder="12" />
  <button onclick="submitLoan()">Validate Loan (Section 1071)</button>
</div>

<div id="result"></div>
<div id="err" class="err"></div>

<script>
const vscode = acquireVsCodeApi();

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const names = ['wire', 'ofac', 'loan'];
    t.classList.toggle('active', names[i] === name);
  });
  ['wirePanel', 'ofacPanel', 'loanPanel'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  document.getElementById(name + 'Panel').classList.add('active');
}

function submitWire() {
  const amount = parseFloat(document.getElementById('w_amount').value);
  if (isNaN(amount) || amount <= 0) { showErr('Amount must be positive'); return; }
  clearResult();
  vscode.postMessage({ type: 'wireTransfer', payload: {
    amount,
    currency: 'USD',
    sender_name: document.getElementById('w_sender').value.trim(),
    beneficiary_name: document.getElementById('w_bene').value.trim(),
    beneficiary_country: document.getElementById('w_country').value.trim().toUpperCase() || 'US',
    is_international: document.getElementById('w_country').value.trim().toUpperCase() !== 'US',
  }});
}

function submitOFAC() {
  const name = document.getElementById('o_name').value.trim();
  if (!name) { showErr('Party name required'); return; }
  clearResult();
  vscode.postMessage({ type: 'ofacScreen', payload: {
    party_name: name,
    party_country: document.getElementById('o_country').value.trim().toUpperCase() || undefined,
  }});
}

function submitLoan() {
  clearResult();
  const payload = {
    race_of_principal_owner: document.getElementById('l_race').value,
    sex_of_principal_owner: document.getElementById('l_sex').value,
    ethnicity_of_principal_owner: document.getElementById('l_ethnicity').value,
  };
  const naics = document.getElementById('l_naics').value.trim();
  if (naics) payload.naics_code = naics;
  const rev = parseFloat(document.getElementById('l_revenue').value);
  if (!isNaN(rev)) payload.business_gross_revenue = rev;
  const workers = parseInt(document.getElementById('l_workers').value, 10);
  if (!isNaN(workers)) payload.number_of_workers = workers;
  vscode.postMessage({ type: 'loanApp', payload });
}

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'result') {
    renderResult(msg);
  } else if (msg.type === 'error') {
    showErr(msg.message);
  }
});

function renderResult(msg) {
  const isBlock = msg.action.toLowerCase().includes('block') || msg.action.toLowerCase() === 'deny';
  const cls = isBlock ? 'action-block' : 'action-allow';
  let html = '<strong>' + msg.label + '</strong><br>' +
             '<span class="' + cls + '">' + msg.action + '</span>' +
             ' &nbsp; <small>' + msg.latency_ms.toFixed(1) + ' ms</small>';

  if (msg.violations && msg.violations.length > 0) {
    html += '<br><small>' + msg.violations.length + ' violation(s):</small>';
    msg.violations.forEach(v => {
      const sev = v.severity.toLowerCase();
      html += '<div class="violation ' + (sev === 'critical' || sev === 'high' ? 'violation-critical' : '') + '">' +
        '<strong>[' + v.severity + '] ' + v.regulation + '</strong><br>' +
        v.description + '<br><em>' + v.recommendation + '</em></div>';
    });
  } else {
    html += '<br><small style="opacity:0.7">No violations found.</small>';
  }

  document.getElementById('result').innerHTML = html;
}

function clearResult() {
  document.getElementById('result').innerHTML = 'Running…';
  document.getElementById('err').textContent = '';
}

function showErr(msg) {
  document.getElementById('err').textContent = msg;
  document.getElementById('result').innerHTML = '';
}
</script>
</body>
</html>`;
    }
}
exports.ValidationPanel = ValidationPanel;
ValidationPanel.viewId = 'fortressValidationPanel';
//# sourceMappingURL=ValidationPanel.js.map