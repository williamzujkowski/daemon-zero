# Security

## Posture

DAEMON // 0 is an offline single-player game. By design it has:

- no network calls, accounts, analytics or telemetry;
- no secrets at runtime;
- one untrusted input: pasted save codes, which are size-limited, schema-validated and reconciled before use (`src/engine/save.ts`).

Any change that adds network access, a third-party SDK or data collection needs an explicit decision by the maintainer and an update to this file.

## Supply chain

- Exact dependency versions and a committed lockfile; installs use `--frozen-lockfile`.
- pnpm does not run dependency build scripts unless a package is explicitly allowed.
- Tool versions (Node, pnpm, scanners) are pinned in `mise.toml`.
- GitHub Actions are pinned by full commit SHA.
- `make security` runs `pnpm audit`, `gitleaks`, `osv-scanner` and `trivy`; `make sbom` writes a CycloneDX SBOM.
- Dependabot proposes updates weekly; updates go through the same gates as any other change.

## Secrets

Signing keys and store credentials (M6) are provided through environment variables or EAS secrets and are never committed. `gitleaks` runs in CI.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository. Please do not file public issues for security problems.
