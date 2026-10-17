#!/usr/bin/env bash
# scripts/deploy-contracts-map.sh
#
# WARNING: this script only works in the MiniMax-hosted agent environment that
# provides the `mavis-website_deploy` tool. Anywhere else it exits with code 3.
# It is not a general deploy path. For any other host, see
# docs/static-hosting.md (static hosting of landing/ through any provider).
#
# One-shot deploy for the static `landing/m15-contracts/index.html` page via the
# `mavis-website_deploy` App. The owner token is read from the environment
# (`M15_DEPLOY_TOKEN`) and is passed to the tool through its environment, never
# as a command-line argument, so it does not show up in `ps` output. The script
# never prints the token.
#
# Usage (inside that environment only):
#   export M15_DEPLOY_TOKEN=...   # set by the owner, never committed
#   ./scripts/deploy-contracts-map.sh
#
# After a successful run, the page is reachable at the URL the tool prints.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SRC="${REPO_ROOT}/landing/m15-contracts/index.html"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/auditai-contracts-map.XXXXXX")"
trap 'rm -rf "${STAGE_DIR}"' EXIT

if [[ ! -f "${SRC}" ]]; then
  echo "ERROR: missing ${SRC}" >&2
  exit 2
fi

if ! command -v mavis-website_deploy >/dev/null 2>&1; then
  echo "ERROR: mavis-website_deploy is not on PATH (only available in the MiniMax agent environment)." >&2
  exit 3
fi

if [[ -z "${M15_DEPLOY_TOKEN:-}" ]]; then
  echo "ERROR: M15_DEPLOY_TOKEN is required (owner-only). Value not printed." >&2
  exit 4
fi

cp "${SRC}" "${STAGE_DIR}/index.html"

# The token travels in the environment of the child process only.
M15_DEPLOY_TOKEN="${M15_DEPLOY_TOKEN}" mavis-website_deploy \
  --source "${STAGE_DIR}" \
  --project "auditai-contracts-map"

echo "Deployed: landing/m15-contracts/index.html"
