# Fortress — Banking Test & Validation (VS Code Extension)

A VS Code extension that connects directly to your **Pipeline 2** server running inside your VPC.  
Generate pytest test suites from JIRA stories via the 6-agent AI pipeline, and run live compliance validations against OCC, OFAC, and CFPB rules — all without customer data leaving your network.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Install the Extension](#2-install-the-extension)
   - [Option A — Install from `.vsix` package (recommended)](#option-a--install-from-vsix-package-recommended)
   - [Option B — Run from source in development mode](#option-b--run-from-source-in-development-mode)
3. [First-Time Setup](#3-first-time-setup)
4. [Command Reference](#4-command-reference)
5. [Sidebar Panels](#5-sidebar-panels)
6. [Workflow: Generate Tests from a JIRA Story](#6-workflow-generate-tests-from-a-jira-story)
7. [Compliance Validation](#7-compliance-validation)
8. [JIRA Setup](#8-jira-setup)
9. [Testing with curl](#9-testing-with-curl)
10. [Example Test Cases](#10-example-test-cases)
11. [Settings Reference](#11-settings-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Requirement | Details |
|---|---|
| **VS Code** | Version 1.80.0 or later |
| **Node.js** | v18 or later (only needed to build from source) |
| **Pipeline 2 server** | Running and reachable from your machine (default: `http://54.174.78.213:8000`) |
| **JIRA** | Any JIRA instance — you enter story details manually in the extension |

> **No API key required.** Pipeline 2 is secured by your VPC network boundary. The extension connects directly to the Pipeline 2 FastAPI server.

---

## 2. Install the Extension

### Option A — Install from `.vsix` package (recommended)

This is the standard way to distribute a private VS Code extension without publishing to the Marketplace.

**Step 1 — Build the `.vsix` package** (one-time, on any machine with Node.js)

```bash
# Navigate to the plugin directory
cd vscode_fortress/textmind_plugin

# Install dependencies
npm install

# Install the VS Code Extension Manager (vsce) globally
npm install -g @vscode/vsce

# Compile TypeScript → JavaScript
npm run compile

# Package into a .vsix file
vsce package --no-dependencies
```

This produces a file named **`fortress-pipeline2-2.0.0.vsix`** in the current directory.

**Step 2 — Install the `.vsix` into VS Code**

*Via the command palette:*
1. Open VS Code
2. Press `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`)
3. Type: `Extensions: Install from VSIX…`
4. Select the `fortress-pipeline2-2.0.0.vsix` file
5. Click **Install** in the confirmation dialog
6. Reload VS Code when prompted

*Via the terminal:*
```bash
code --install-extension fortress-pipeline2-2.0.0.vsix
```

---

### Option B — Run from source in development mode

Use this if you want to iterate on the plugin code without packaging it every time.

```bash
cd vscode_fortress/textmind_plugin
npm install
npm run compile
```

Then in VS Code:
1. Open the `textmind_plugin` folder as a workspace (`File → Open Folder`)
2. Press **F5** — this opens a new **Extension Development Host** window with the plugin active
3. All changes: run `npm run compile` again, then reload the host window (`Ctrl+R`)

To watch for changes automatically:
```bash
npm run watch   # recompiles on every file save
```

---

## 3. First-Time Setup

After installation, the extension will prompt you automatically:

> *"Fortress: configure your Pipeline 2 URL to get started."*

Click **Configure**, or open the command palette and run:

```
Fortress: Configure Pipeline 2 URL
```

Enter the base URL of your Pipeline 2 server:

| Scenario | URL |
|---|---|
| **Fortress EC2 server (default)** | `http://54.174.78.213:8000` |
| Running locally with Docker Compose | `http://localhost:8000` |
| Deployed inside VPC | `https://fortress-pipeline2.internal` |
| Deployed on a specific port | `http://10.0.1.50:8001` |

The extension will test connectivity before saving. If the server is not reachable it will warn you and ask whether to save anyway.

**Verify the connection at any time:**

```
Ctrl+Shift+P → Fortress: Check Pipeline 2 Health
```

---

## 4. Command Reference

All commands are available from the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) under the `Fortress:` prefix.

| Command | What it does |
|---|---|
| `Fortress: Configure Pipeline 2 URL` | Set the base URL of your Pipeline 2 server |
| `Fortress: Check Pipeline 2 Health` | Ping `/health/` and `/health/ready` to confirm the server is up |
| `Fortress: Generate Tests from JIRA Story` | Submit a JIRA story to the 6-agent pipeline and receive generated pytest code |
| `Fortress: View Workflow Status` | Look up any workflow by its ID and view artifacts / test code |
| `Fortress: Validate Wire Transfer` | Run a wire transfer against OCC BSA/AML rules |
| `Fortress: Screen OFAC Sanctions` | Screen a party name against the OFAC SDN list |
| `Fortress: Validate Loan Application` | Check a small-business loan against CFPB Section 1071 |

---

## 5. Sidebar Panels

Click the **Fortress shield icon** in the VS Code activity bar to open the sidebar. It has three panels:

### Generate Tests
A form where you type a JIRA story key, summary, and description and click **Run 6-Agent Pipeline**. Shows live agent progress inline and displays the generated test code directly in the panel when complete.

### Workflow Status
Enter any workflow ID to see its current state (`pending` / `running` / `waiting_approval` / `completed` / `failed`), quality score, timestamps, and generated test code. If the workflow is waiting for an approval checkpoint, **Approve / Reject** buttons appear inline.

### Compliance Validation
Three tabbed validators:
- **Wire Transfer** — BSA/AML check (amount, sender, beneficiary, country)
- **OFAC** — SDN sanctions screen (party name + optional country)
- **Loan (1071)** — CFPB Section 1071 demographic compliance check

Results are displayed inline with per-violation regulation ID, severity, description, and recommendation.

---

## 6. Workflow: Generate Tests from a JIRA Story

This is the primary developer workflow. It uses the 6-agent AI pipeline inside Pipeline 2.

### Using the Command Palette

1. `Ctrl+Shift+P` → **Fortress: Generate Tests from JIRA Story**
2. Enter **JIRA key** (e.g. `BANK-456`)
3. Enter **story summary** — one line, at least 10 characters
4. Enter **story description** — full acceptance criteria, at least 20 characters
5. A progress notification appears showing each agent step:
   - Discovery agent analysing story
   - Understanding agent building semantic model
   - Framework agent selecting test strategy
   - Generation agent writing pytest code
   - Validation agent checking compliance rules
   - Execution agent running tests
6. When complete, click **Open Test Code** to open the generated `pytest` file in a new editor tab, or **Show Artifacts** to see the full JSON output from all agents.

### Using the Sidebar

Open the **Generate Tests** panel in the Fortress sidebar, fill in the same three fields, and click **Run 6-Agent Pipeline**. Agent progress appears inline; the generated test code appears directly in the panel when done.

### Approval Checkpoints

If Pipeline 2 is configured to require human approval (e.g. to review generated scenarios before code generation), the workflow will pause at a `waiting_approval` status. The extension will:
- Show an **Approve / Reject** prompt (command palette flow)
- Show **Approve / Reject** buttons in the Workflow Status sidebar panel

After you approve, polling resumes automatically and the final test code is delivered.

### Viewing a Previous Workflow

```
Ctrl+Shift+P → Fortress: View Workflow Status
```
Enter the workflow ID that was returned when the story was submitted. The workflow ID is a UUID (e.g. `3fa85f64-5717-4562-b3fc-2c963f66afa6`).

---

## 7. Compliance Validation

These commands test your data against Pipeline 2's production validators. All data stays inside your VPC — only locally-synced compliance rules are used.

### Wire Transfer (OCC BSA/AML)

**Command palette:** `Fortress: Validate Wire Transfer`  
**Sidebar:** Compliance Validation → Wire Transfer tab

You will be prompted for:
- **Amount** — transfer amount in USD
- **Sender name** — full legal name of sender
- **Beneficiary name** — full legal name of recipient
- **Beneficiary country** — 2-letter ISO code (default: `US`)

**What Pipeline 2 checks:**
- OFAC SDN screening of beneficiary
- CTR threshold — cash transactions ≥ $10,000
- Travel Rule — recordkeeping for transfers ≥ $3,000
- Dual-approval requirement for large wires
- International wire restrictions

**Result:**  
`ALLOW` or `BLOCK` with a list of violations. Each violation shows regulation name, rule ID, severity, description, and recommendation. Click **View Details** to open a markdown report in a new tab.

---

### OFAC Sanctions Screen

**Command palette:** `Fortress: Screen OFAC Sanctions`  
**Sidebar:** Compliance Validation → OFAC tab

You will be prompted for:
- **Party name** — individual or entity name (fuzzy-matched against SDN list)
- **Party country** — 2-letter ISO code (optional, narrows the match)

**What Pipeline 2 checks:**
- Fuzzy name matching against the OFAC SDN list
- Country-level sanctions programme membership
- Real-time block/allow decision

---

### Loan Application (CFPB Section 1071)

**Command palette:** `Fortress: Validate Loan Application`  
**Sidebar:** Compliance Validation → Loan (1071) tab

You will be prompted for (all optional except demographics):
- Race of principal owner
- Sex of principal owner
- Ethnicity of principal owner
- NAICS code (6-digit industry classification)
- Business gross annual revenue
- Number of workers

**What Pipeline 2 checks:**
- Required demographic field collection
- Firewall rule — underwriter isolation from demographic data
- NAICS code presence
- Business gross revenue collection

---

## 8. JIRA Setup

The Fortress plugin works in two modes. You can start immediately with **Manual Mode** (no JIRA account needed). **Connected Mode** wires Pipeline 2 to your real JIRA instance so it can read stories directly.

---

### Mode 1 — Manual Mode (no JIRA credentials required)

The plugin does **not** connect to JIRA itself. You just type the story details directly into the extension. No JIRA account, API token, or webhook configuration is needed.

1. Open the **Generate Tests** panel or run `Fortress: Generate Tests from JIRA Story`
2. Enter your JIRA key (e.g. `BANK-456`), summary, and description manually
3. Click **Run 6-Agent Pipeline**

This is the fastest way to start and works even if your JIRA instance is not accessible from the EC2 server.

---

### Mode 2 — Connected Mode (Pipeline 2 reads from real JIRA)

In connected mode, Pipeline 2 uses your JIRA credentials to fetch story details directly and can also receive live webhook events from JIRA when issues are created or updated.

#### Step 1 — Generate a JIRA API Token

1. Log in to your Atlassian account at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Go to **Security → API tokens → Create API token**
3. Name it (e.g. `fortress-pipeline2`) and click **Create**
4. Copy the token — it is only shown once

#### Step 2 — Configure Pipeline 2 on the EC2 server

SSH into the EC2 server and update the Pipeline 2 environment file:

```bash
ssh ubuntu@54.174.78.213
sudo nano /opt/fortress/.env
```

Set the following values:

```bash
# JIRA Integration
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=automation@yourcompany.com
JIRA_API_TOKEN=<paste token from Step 1>
JIRA_WEBHOOK_SECRET=<any random string, e.g. fortress-secret-2024>
```

Restart Pipeline 2 to pick up the new config:

```bash
cd /opt/fortress
docker compose -f docker-compose.pipeline1.prod.yml restart fortress-pipeline1
```

Verify JIRA connectivity from the server:

```bash
curl -u automation@yourcompany.com:<api-token> \
  https://your-company.atlassian.net/rest/api/2/myself
# Expected: JSON with your account details
```

#### Step 3 (Optional) — Register a JIRA Webhook for automatic triggering

With a webhook, Pipeline 2 will automatically start the 6-agent pipeline whenever a story is created or updated in JIRA — no manual submission needed.

1. In JIRA, go to **Settings → System → WebHooks** (requires JIRA admin)
2. Click **Create a WebHook**
3. Fill in:

| Field | Value |
|---|---|
| Name | `Fortress Pipeline 2` |
| URL | `http://54.174.78.213:8000/webhooks/jira` |
| Events | `Issue: created`, `Issue: updated` |
| JQL Filter (optional) | `project = BANK AND issuetype = Story` |

4. Click **Create**

> **Note:** JIRA must be able to reach `54.174.78.213` port `8000` over the network. If JIRA Cloud is being used and the EC2 server is in a private VPC, you will need to open port 8000 in the EC2 security group to allow inbound connections from Atlassian's IP ranges.

#### Test the webhook manually

```bash
curl -X POST http://54.174.78.213:8000/webhooks/jira \
  -H 'Content-Type: application/json' \
  -d '{
    "issue": {
      "key": "BANK-101",
      "fields": {
        "summary": "Wire transfer must screen OFAC SDN list before processing",
        "description": "As a compliance officer, I need all wire transfers over $10,000 to be screened against the OFAC SDN list before processing. The system must block any transfer to a sanctioned entity and file a SAR within 30 days."
      }
    }
  }'
# Expected: {"status":"processing","workflow_id":"<uuid>","jira_key":"BANK-101"}
```

Copy the `workflow_id` from the response and check status in VS Code:  
`Ctrl+Shift+P` → `Fortress: View Workflow Status` → paste the ID.

---

### Summary: which mode do you need?

| Scenario | Mode |
|---|---|
| Just want to try the plugin now | Manual Mode — no setup needed |
| Pipeline 2 should fetch real story details from JIRA | Connected Mode — Steps 1 & 2 |
| JIRA should auto-trigger the pipeline on issue events | Connected Mode — Steps 1, 2 & 3 |

---

## 9. Testing with curl

Use these commands to verify the Pipeline 2 server is working correctly before (or alongside) using the VS Code extension. All commands target `http://54.174.78.213:8000`.

> **Tip:** Add `-s | python3 -m json.tool` to any command to pretty-print the JSON response.  
> Example: `curl -s http://54.174.78.213:8000/health/ | python3 -m json.tool`

---

### Health & Readiness

**Basic health check**
```bash
curl http://54.174.78.213:8000/health/
# Expected: {"status":"healthy","service":"TEXT MIND Backend"}
```

**Readiness check** (confirms database, Redis, and Weaviate are all up)
```bash
curl http://54.174.78.213:8000/health/ready
# Expected: {"ready":true}
```

---

### Generate Tests — Trigger the 6-Agent Pipeline

Submit a JIRA story and receive a `workflow_id` to track progress.

```bash
curl -X POST http://54.174.78.213:8000/webhooks/jira \
  -H 'Content-Type: application/json' \
  -d '{
    "issue": {
      "key": "BANK-101",
      "fields": {
        "summary": "Wire transfer must screen OFAC SDN list before processing",
        "description": "As a compliance officer, I need all wire transfers over $10,000 to be screened against the OFAC SDN list before processing. The system must block any transfer to a sanctioned entity and file a SAR within 30 days. Dual approval required for transfers above $50,000."
      }
    }
  }'
# Expected: {"status":"processing","workflow_id":"<uuid>","jira_key":"BANK-101"}
```

Save the `workflow_id` from the response — you will need it for the next commands.

---

### Workflow Status

**Check current status and artifacts**
```bash
curl http://54.174.78.213:8000/workflows/<workflow_id>
# Expected: {"workflow_id":"...","status":"running"|"completed"|"failed","quality_score":...,"artifacts":{...}}
```

**Poll until complete** (runs every 5 seconds, stops on completed/failed)
```bash
WORKFLOW_ID=<workflow_id>
while true; do
  STATUS=$(curl -s http://54.174.78.213:8000/workflows/$WORKFLOW_ID | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "$(date '+%H:%M:%S') status: $STATUS"
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then break; fi
  sleep 5
done
```

**Extract generated test code from completed workflow**
```bash
curl -s http://54.174.78.213:8000/workflows/<workflow_id> \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['artifacts'].get('test_code','(no test_code in artifacts)'))"
```

---

### Approvals (if workflow is waiting_approval)

**Check pending approvals**
```bash
curl http://54.174.78.213:8000/approvals/<workflow_id>
# Expected: {"approvals":[{"id":"...","checkpoint":"scenarios","created_at":"..."}]}
```

**Approve a checkpoint**
```bash
curl -X POST http://54.174.78.213:8000/approvals/ \
  -H 'Content-Type: application/json' \
  -d '{
    "workflow_id": "<workflow_id>",
    "checkpoint": "scenarios",
    "decision": "approved"
  }'
# Expected: {"status":"approved"}
```

**Reject a checkpoint**
```bash
curl -X POST http://54.174.78.213:8000/approvals/ \
  -H 'Content-Type: application/json' \
  -d '{
    "workflow_id": "<workflow_id>",
    "checkpoint": "scenarios",
    "decision": "rejected"
  }'
```

---

### Compliance Validation

#### Wire Transfer (OCC BSA/AML)

**Small domestic wire — expect ALLOW**
```bash
curl -X POST http://54.174.78.213:8000/validate/wire-transfer \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 500,
    "currency": "USD",
    "sender_name": "Alice Johnson",
    "beneficiary_name": "Bob Williams",
    "beneficiary_country": "US",
    "is_international": false
  }'
```

**Large domestic wire ($12k) — expect ALLOW with CTR violation**
```bash
curl -X POST http://54.174.78.213:8000/validate/wire-transfer \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 12000,
    "currency": "USD",
    "sender_name": "Carlos Rivera",
    "beneficiary_name": "Sunrise Construction LLC",
    "beneficiary_country": "US",
    "is_international": false
  }'
```

**Large international wire to sanctioned country — expect BLOCK**
```bash
curl -X POST http://54.174.78.213:8000/validate/wire-transfer \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 75000,
    "currency": "USD",
    "sender_name": "John Smith",
    "beneficiary_name": "Global Trade Partners",
    "beneficiary_country": "IR",
    "is_international": true
  }'
```

---

#### OFAC Sanctions Screen

**Clean party — expect ALLOW**
```bash
curl -X POST http://54.174.78.213:8000/validate/ofac-screen \
  -H 'Content-Type: application/json' \
  -d '{
    "party_name": "Acme Hardware Supply",
    "party_country": "US"
  }'
```

**Sanctioned country — expect BLOCK**
```bash
curl -X POST http://54.174.78.213:8000/validate/ofac-screen \
  -H 'Content-Type: application/json' \
  -d '{
    "party_name": "Tehran Exports Ltd",
    "party_country": "IR"
  }'
```

---

#### Loan Application (CFPB Section 1071)

**All fields provided — expect ALLOW**
```bash
curl -X POST http://54.174.78.213:8000/validate/loan-application \
  -H 'Content-Type: application/json' \
  -d '{
    "race_of_principal_owner": "Asian",
    "sex_of_principal_owner": "Female",
    "ethnicity_of_principal_owner": "Not Hispanic or Latino",
    "naics_code": "522110",
    "business_gross_revenue": 2500000,
    "number_of_workers": 12
  }'
```

**All fields blank — expect violations**
```bash
curl -X POST http://54.174.78.213:8000/validate/loan-application \
  -H 'Content-Type: application/json' \
  -d '{
    "race_of_principal_owner": "Not Provided",
    "sex_of_principal_owner": "Not Provided",
    "ethnicity_of_principal_owner": "Not Provided"
  }'
```

---

### Quick end-to-end script

Runs a full pipeline trigger → poll → print test code in one shot:

```bash
#!/bin/bash
BASE=http://54.174.78.213:8000

echo "==> Triggering pipeline..."
RESPONSE=$(curl -s -X POST $BASE/webhooks/jira \
  -H 'Content-Type: application/json' \
  -d '{
    "issue": {
      "key": "BANK-999",
      "fields": {
        "summary": "Wire transfer OFAC screening requirement",
        "description": "All wire transfers over $10,000 must be screened against the OFAC SDN list. Block sanctioned entities immediately and file a SAR within 30 days."
      }
    }
  }')

echo "Response: $RESPONSE"
WORKFLOW_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['workflow_id'])")
echo "==> Workflow ID: $WORKFLOW_ID"

echo "==> Polling for completion..."
while true; do
  RESULT=$(curl -s $BASE/workflows/$WORKFLOW_ID)
  STATUS=$(echo $RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "$(date '+%H:%M:%S') $STATUS"
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then
    echo "==> Final status: $STATUS"
    echo $RESULT | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Quality score:', d.get('quality_score'))
code = d.get('artifacts', {}).get('test_code', '')
if code:
    print('--- Generated test code ---')
    print(code[:2000])
else:
    print('(no test_code in artifacts)')
"
    break
  fi
  sleep 5
done
```

---

## 10. Example Test Cases

Use these examples to verify the extension is working correctly end-to-end.

---

### Example 1 — Generate Tests from JIRA Story

**Command:** `Fortress: Generate Tests from JIRA Story`

| Field | Value |
|---|---|
| JIRA Key | `BANK-101` |
| Summary | `Wire transfer must screen OFAC SDN list before processing` |
| Description | `As a compliance officer, I need all wire transfers over $10,000 to be screened against the OFAC SDN list before processing. The system must block any transfer to a sanctioned entity and file a SAR within 30 days. Dual approval is required for transfers above $50,000. International wires require additional beneficiary documentation.` |

**Expected outcome:** The 6-agent pipeline runs (~1–5 minutes), workflow reaches `completed`, and generated pytest code opens in a new editor tab covering OFAC screening, CTR threshold, Travel Rule, and dual-approval scenarios.

---

### Example 2 — Wire Transfer: should be BLOCKED (large international wire)

**Command:** `Fortress: Validate Wire Transfer`

| Field | Value |
|---|---|
| Amount | `75000` |
| Sender name | `John Smith` |
| Beneficiary name | `Global Trade Partners` |
| Beneficiary country | `IR` |

**Expected outcome:** `BLOCK` — violations for international wire restriction and OFAC country-level sanctions (Iran).

---

### Example 3 — Wire Transfer: should be ALLOWED (small domestic wire)

**Command:** `Fortress: Validate Wire Transfer`

| Field | Value |
|---|---|
| Amount | `500` |
| Sender name | `Alice Johnson` |
| Beneficiary name | `Bob Williams` |
| Beneficiary country | `US` |

**Expected outcome:** `ALLOW` — no violations, well below CTR and Travel Rule thresholds.

---

### Example 4 — Wire Transfer: CTR threshold trigger

**Command:** `Fortress: Validate Wire Transfer`

| Field | Value |
|---|---|
| Amount | `12000` |
| Sender name | `Carlos Rivera` |
| Beneficiary name | `Sunrise Construction LLC` |
| Beneficiary country | `US` |

**Expected outcome:** `ALLOW` with a CTR violation flagged (cash transaction ≥ $10,000 requires Currency Transaction Report filing).

---

### Example 5 — OFAC Screen: clean party (should be ALLOWED)

**Command:** `Fortress: Screen OFAC Sanctions`

| Field | Value |
|---|---|
| Party name | `Acme Hardware Supply` |
| Party country | `US` |

**Expected outcome:** `ALLOW` — no SDN match found.

---

### Example 6 — OFAC Screen: sanctioned country (should be BLOCKED)

**Command:** `Fortress: Screen OFAC Sanctions`

| Field | Value |
|---|---|
| Party name | `Tehran Exports Ltd` |
| Party country | `IR` |

**Expected outcome:** `BLOCK` — country-level sanctions programme match for Iran.

---

### Example 7 — Loan Application: compliant (all fields provided)

**Command:** `Fortress: Validate Loan Application`

| Field | Value |
|---|---|
| Race | `Asian` |
| Sex | `Female` |
| Ethnicity | `Not Hispanic or Latino` |
| NAICS code | `522110` |
| Gross annual revenue | `2500000` |
| Number of workers | `12` |

**Expected outcome:** `ALLOW` — all required Section 1071 fields collected, no violations.

---

### Example 8 — Loan Application: missing required fields (should flag violations)

**Command:** `Fortress: Validate Loan Application`

| Field | Value |
|---|---|
| Race | `Not Provided` |
| Sex | `Not Provided` |
| Ethnicity | `Not Provided` |
| NAICS code | *(leave blank)* |
| Gross annual revenue | *(leave blank)* |
| Number of workers | *(leave blank)* |

**Expected outcome:** Multiple violations — demographic fields not collected, NAICS code missing, gross revenue missing. Action will be `REVIEW` or `BLOCK` depending on Pipeline 2 rule configuration.

---

### Quick health check (verify server is up before running examples)

```bash
curl http://54.174.78.213:8000/health/
# Expected: {"status":"healthy","service":"TEXT MIND Backend"}

curl http://54.174.78.213:8000/health/ready
# Expected: {"ready":true}
```

Or in VS Code: `Ctrl+Shift+P` → `Fortress: Check Pipeline 2 Health`

---

## 11. Settings Reference

Open VS Code settings (`Ctrl+,`) and search for `fortress`, or edit your `settings.json` directly:

```jsonc
{
  // Base URL of your Pipeline 2 server (no trailing slash)
  "fortress.pipeline2Url": "http://54.174.78.213:8000",

  // How often to poll for workflow status (milliseconds)
  // Min: 1000, Max: 30000, Default: 3000
  "fortress.pollIntervalMs": 3000,

  // Maximum time to wait for a workflow to complete (milliseconds)
  // Min: 10000, Max: 600000, Default: 300000 (5 minutes)
  "fortress.pollTimeoutMs": 300000
}
```

---

## 12. Troubleshooting

### "Cannot reach Pipeline 2 — is the server running and accessible?"

Pipeline 2 is not running or the URL is wrong.

```bash
# Check if Pipeline 2 is up with Docker Compose
docker compose -f docker-compose.pipeline1.prod.yml ps

# Start it if not running
docker compose -f docker-compose.pipeline1.prod.yml up -d

# Verify the health endpoint manually
curl http://54.174.78.213:8000/health/
# Expected: {"status":"healthy","service":"TEXT MIND Backend"}
```

---

### "Workflow did not complete within 300s"

The 6-agent pipeline is taking longer than expected. Increase the timeout in settings:

```jsonc
"fortress.pollTimeoutMs": 600000
```

Or check Pipeline 2 logs:

```bash
docker logs fortress-pipeline1 --tail 100 -f
```

---

### "No test_code found in workflow artifacts"

The workflow completed but the generation agent produced no code. Common causes:

- **LLM mock mode** — `LLM_MOCK_MODE=true` is set in Pipeline 2's environment. The mock agent returns stub code without calling an LLM. Check `artifacts.source` in the full artifacts JSON.
- **Story too vague** — Add more detail to the JIRA story description, particularly banking domain context (regulation names, transaction types, thresholds).
- **Agent failure** — Check Pipeline 2 logs for errors from the generation or validation agents.

---

### Extension not showing in sidebar

1. Make sure the extension is installed and enabled (`Extensions` view → search for `Fortress`)
2. Reload VS Code: `Ctrl+Shift+P` → `Developer: Reload Window`
3. If running from source, ensure the Extension Development Host window is open (press F5 in the plugin folder)

---

### Workflow stuck in `waiting_approval`

Pipeline 2 paused for a human checkpoint. Either:
- Use `Fortress: View Workflow Status`, enter the workflow ID, and click **Approve**
- Or call the API directly:
  ```bash
  curl -X POST http://54.174.78.213:8000/approvals/ \
    -H 'Content-Type: application/json' \
    -d '{"workflow_id":"<id>","checkpoint":"scenarios","decision":"approved"}'
  ```
