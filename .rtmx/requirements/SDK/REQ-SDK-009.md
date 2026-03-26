# REQ-SDK-009: Plugin Distribution, Discovery, and Verification

## Overview

Plugins are distributed as GitHub repos with release binaries. There is no central registry or marketplace. A plugin's identity is its GitHub repo URL. Installation, verification, and trust are handled through a three-layer validation chain that ensures aegis-cli never executes an unverified or non-compliant binary.

## Specification

### Installation Command

```
aegis plugin install github.com/{owner}/{repo}
aegis plugin install github.com/{owner}/{repo}@v0.2.0   # specific version
```

The argument is a GitHub repo path, not a package name. No central registry lookup.

### plugin.json (Repo-Level Metadata)

Every plugin repo must contain a `plugin.json` in the repo root:

```json
{
  "aegis-plugin": true,
  "contract": "aegis-infra/v1",
  "name": "gcp-assured-workloads",
  "description": "IL4/IL5 Assured Workloads boundary in Google Cloud",
  "binary-prefix": "gcp-assured-workloads"
}
```

| Field | Required | Purpose |
|-------|----------|---------|
| aegis-plugin | Yes | Boolean flag. Must be `true`. Identifies the repo as a plugin. |
| contract | Yes | Protocol version. aegis-cli rejects incompatible versions. |
| name | Yes | Plugin name. Must match the manifest output from the binary. |
| description | Yes | Human-readable description shown during install. |
| binary-prefix | Yes | Prefix for release asset names. Binary is `{prefix}-{platform}`. |

This file is checked into the repo root and fetched via GitHub API before any binary download.

### Release Asset Naming Convention

Each GitHub Release must contain:

| Asset | Pattern | Example |
|-------|---------|---------|
| Binary (macOS ARM) | `{prefix}-darwin-arm64` | `gcp-assured-workloads-darwin-arm64` |
| Binary (macOS x64) | `{prefix}-darwin-x64` | `gcp-assured-workloads-darwin-x64` |
| Binary (Linux x64) | `{prefix}-linux-x64` | `gcp-assured-workloads-linux-x64` |
| Binary (Linux ARM) | `{prefix}-linux-arm64` | `gcp-assured-workloads-linux-arm64` |
| Binary (Windows) | `{prefix}-windows-x64.exe` | `gcp-assured-workloads-windows-x64.exe` |
| Checksums | `SHA256SUMS.txt` | `SHA256SUMS.txt` |
| Signature | `{prefix}-{platform}.bundle` | `gcp-assured-workloads-darwin-arm64.bundle` |

### Three-Layer Validation Chain

**Layer 1: Repo validation (before binary download)**
1. Fetch `plugin.json` from repo via `GET /repos/{owner}/{repo}/contents/plugin.json`
2. Verify `aegis-plugin` is `true`
3. Verify `contract` is compatible with this version of aegis-cli
4. Display `name` and `description` to user for confirmation
5. If any check fails: abort with "Not a valid aegis plugin"

**Layer 2: Release validation (before execution)**
1. Fetch latest release (or specified version) via GitHub API
2. Locate platform binary asset matching `{binary-prefix}-{platform}`
3. Download binary + `SHA256SUMS.txt` + `.bundle` signature
4. Verify SHA256 checksum
5. Verify cosign signature against Sigstore transparency log
   - Signing identity must be a GitHub Actions OIDC token from the same `{owner}/{repo}`
6. If any check fails: abort with "Release verification failed"

**Layer 3: Binary validation (after download, before marking as verified)**
1. Execute `<binary> manifest` with a 10-second timeout
2. Verify output is valid JSON
3. Verify `contract` field matches `plugin.json` declaration
4. Verify `name` field matches `plugin.json` declaration
5. If any check fails: delete binary, abort with "Binary does not conform to plugin contract"

### Plugin Registry (Local State)

Verified plugins are tracked in `~/.aegis/plugins/registry.json`:

```json
{
  "plugins": [
    {
      "name": "gcp-assured-workloads",
      "repo": "github.com/rtmx-ai/gcp-assured-workloads",
      "version": "v0.2.0",
      "binary": "~/.aegis/plugins/gcp-assured-workloads",
      "sha256": "abc123...",
      "installed": "2026-03-26T00:00:00Z",
      "contract": "aegis-infra/v1"
    }
  ]
}
```

### Tamper Check at Invocation

Every time aegis-cli invokes a plugin, it:
1. Reads the registry entry for the plugin
2. Computes SHA256 of the binary on disk
3. Compares to the stored checksum
4. If mismatch: refuses to execute, emits error "Plugin binary has been modified since installation. Run 'aegis plugin reinstall {name}' to re-verify."

### config.yaml Plugin References

```yaml
plugins:
  - repo: github.com/rtmx-ai/gcp-assured-workloads
    version: v0.2.0
```

On startup, aegis-cli checks that all configured plugins are installed and verified. Missing plugins prompt the user to run `aegis plugin install`.

### Signing with Sigstore/cosign

The release workflow uses cosign keyless signing via GitHub Actions OIDC:

```yaml
- uses: sigstore/cosign-installer@v3
- run: cosign sign-blob --yes --bundle {binary}.bundle {binary}
```

Verification:
```
cosign verify-blob --bundle {binary}.bundle \
  --certificate-identity-regexp "https://github.com/{owner}/{repo}/.github/workflows/release.yml@.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  {binary}
```

This confirms the binary was produced by the release workflow in the expected repo.

## BDD Scenarios

### Scenario 1: Install valid plugin from GitHub repo
- Given a valid plugin repo with plugin.json and signed releases
- When "aegis plugin install github.com/rtmx-ai/gcp-assured-workloads"
- Then plugin.json is fetched and validated
- And the platform binary is downloaded and checksum-verified
- And the cosign signature is verified
- And the binary manifest is validated
- And the plugin is registered in registry.json

### Scenario 2: Reject repo without plugin.json
- Given a GitHub repo with no plugin.json
- When "aegis plugin install github.com/someone/not-a-plugin"
- Then the install fails with "Not a valid aegis plugin"
- And no binary is downloaded

### Scenario 3: Reject incompatible contract version
- Given a plugin repo with contract "aegis-infra/v99"
- When "aegis plugin install github.com/someone/future-plugin"
- Then the install fails with "Incompatible protocol version"

### Scenario 4: Reject tampered binary at invocation
- Given an installed plugin
- When the binary file is modified after installation
- And aegis-cli invokes the plugin
- Then execution is refused with "Plugin binary has been modified"

### Scenario 5: Install specific version
- Given a plugin repo with multiple releases
- When "aegis plugin install github.com/rtmx-ai/gcp-assured-workloads@v0.1.0"
- Then version v0.1.0 is installed (not latest)

## Acceptance Criteria

- [AC1] Plugins are installed by GitHub repo URL, not by name
- [AC2] plugin.json is validated before any binary download
- [AC3] Cosign signature verification confirms CI provenance
- [AC4] Binary manifest is validated after download
- [AC5] Tamper detection at every invocation via SHA256 check
- [AC6] No binary is ever executed without passing all three validation layers

## Traceability

- Parent: REQ-SDK-004 (Plugin Release and Distribution)
- Implementation: aegis-cli `aegis-infra` crate (Rust)
- Plugin-side: plugin.json in repo root, cosign signing in release workflow
