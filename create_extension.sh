#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Fortress VS Code Extension — build & package script
#
# Usage:
#   ./create_extension.sh            # compile + package .vsix
#   ./create_extension.sh --install  # compile + package + install into VS Code
#   ./create_extension.sh --dev      # compile only (for F5 dev mode)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-}"

echo "================================================"
echo "  Fortress Pipeline 2 VS Code Extension"
echo "================================================"
echo ""

# ── Step 1: Install npm dependencies ─────────────────────────────────────────
echo "[1/4] Installing npm dependencies..."
npm install --silent
echo "      Done."

# ── Step 2: Compile TypeScript ────────────────────────────────────────────────
echo "[2/4] Compiling TypeScript..."
npm run compile
echo "      Done. Output: out/"

if [[ "$MODE" == "--dev" ]]; then
    echo ""
    echo "Dev mode — skipping packaging."
    echo "Open the 'textmind_plugin' folder in VS Code and press F5 to launch."
    exit 0
fi

# ── Step 3: Install vsce if not present ───────────────────────────────────────
echo "[3/4] Checking for vsce (VS Code Extension Manager)..."
if ! command -v vsce &>/dev/null; then
    echo "      vsce not found — installing globally..."
    npm install -g @vscode/vsce --silent
fi
echo "      vsce: $(vsce --version)"

# ── Step 4: Package into .vsix ────────────────────────────────────────────────
echo "[4/4] Packaging extension..."
VSIX_FILE=$(vsce package 2>&1 | grep -oE '[^ ]+\.vsix' | tail -1)

if [[ -z "$VSIX_FILE" ]]; then
    # Fallback: find the newest .vsix in the current directory
    VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1 || echo "")
fi

if [[ -z "$VSIX_FILE" ]]; then
    echo "ERROR: vsce package did not produce a .vsix file." >&2
    exit 1
fi

echo ""
echo "================================================"
echo "  Package ready: $VSIX_FILE"
echo "================================================"
echo ""

# ── Optional: install into VS Code ───────────────────────────────────────────
if [[ "$MODE" == "--install" ]]; then
    if ! command -v code &>/dev/null; then
        echo "ERROR: 'code' CLI not found." >&2
        echo "  Install it from VS Code: Ctrl+Shift+P → 'Shell Command: Install code in PATH'" >&2
        exit 1
    fi
    echo "Installing into VS Code..."
    code --install-extension "$VSIX_FILE" --force
    echo ""
    echo "Done! Reload VS Code to activate the extension."
    echo "  Ctrl+Shift+P → 'Developer: Reload Window'"
else
    echo "To install manually in VS Code:"
    echo ""
    echo "  Option 1 — Command palette:"
    echo "    Ctrl+Shift+P → 'Extensions: Install from VSIX...'"
    echo "    Select: $VSIX_FILE"
    echo ""
    echo "  Option 2 — Terminal:"
    echo "    code --install-extension $VSIX_FILE"
    echo ""
    echo "  Option 3 — Run this script with --install flag:"
    echo "    ./create_extension.sh --install"
fi
