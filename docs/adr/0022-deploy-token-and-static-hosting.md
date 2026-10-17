# 0022 - Deploy-script token handling and provider-neutral static hosting

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0018](0018-devx-and-deploy.md), [0019](0019-public-routes-playwright.md)

## Context

`scripts/deploy-contracts-map.sh` passed the owner's `M15_DEPLOY_TOKEN` as a
command-line argument (`--token`). Any user on the host can read argv through `ps`.
The script also depends on `mavis-website_deploy`, a tool that exists only in the
MiniMax-hosted agent environment, and that was not stated in the script.

## Decision

1. The token is no longer an argument. The script exports it into the environment of
   the deploy-tool process only. The script never prints it. The deploy tool must read
   `M15_DEPLOY_TOKEN` from its environment, and this is the one assumption the script
   makes about that tool.
2. The script header says that it only works in the MiniMax agent environment, and
   the script exits 3 when the tool is absent.
3. `docs/static-hosting.md` describes how to publish `landing/` through any static
   host (object storage, a CDN, Pages-style hosting, or a plain web server). It uses
   no real hostnames and no secrets.

## Alternatives

- **Keep `--token` and add a warning.** Leaves the token in `ps` output.
- **Read the token from a file.** Still needs file permissions managed on the host,
  and the tool still has to receive the value somehow.
- **Remove the script.** It is the only automated path we have for the contracts-map
  page in that environment, so keep it for now.

## Consequences

- Owners can publish `landing/` without the MiniMax tool, using the generic guide.
- If the deploy tool does not read `M15_DEPLOY_TOKEN` from the environment, the
  script will fail at deploy time with the tool's own auth error. The script does not
  check for this in advance. Verify it the next time the script runs in that environment.
