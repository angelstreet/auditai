#!/usr/bin/env bash
# scripts/deploy-contracts-map.sh
#
# One-shot deploy for the static `landing/m15-contracts/index.html` page
# via the `mavis-website_deploy` tool (a Mavis App on the local surface
# that publishes HTML to a public URL on `space.minimax.io`).
#
# The script is a thin wrapper: it copies the page to a known staging
# directory and asks the deploy tool to publish from there. Owner
# credentials live in `M15_DEPLOY_TOKEN` (owner-only) and are read by
# the deploy tool, not by this script.
#
# Usage:
#   export M15_DEPLOY_TOKEN=...
#   ./scripts/deploy-contracts-map.sh
#
# After a successful run, the page is reachable at the URL the tool
# prints (typically https://<id>.space.minimax.io).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SRC="${REPO_ROOT}/landing/m15-contracts/index.html"
STAGE_DIR="${TMPDIR:-/tmp}/auditai-contracts-map-$$"

if [[ ! -f "${SRC}" ]]; then
  echo "ERROR: missing ${SRC}" >&2
  exit 2
fi

mkdir -p "${STAGE_DIR}"
cp "${SRC}" "${STAGE_DIR}/index.html"

if ! command -v mavis-website_deploy >/dev/null 2>&1; then
  echo "ERROR: mavis-website_deploy is not on PATH; install via App install." >&2
  rm -rf "${STAGE_DIR}"
  exit 3
fi

if [[ -z "${M15_DEPLOY_TOKEN:-}" ]]; then
  echo "ERROR: M15_DEPLOY_TOKEN is required (owner-only)." >&2
  rm -rf "${STAGE_DIR}"
  exit 4
fi

mavis-website_deploy \
  --source "${STAGE_DIR}" \
  --project "auditai-contracts-map" \
  --token "${M15_DEPLOY_TOKEN}"

rm -rf "${STAGE_DIR}"
echo "Deployed: landing/m15-contracts/index.html"
