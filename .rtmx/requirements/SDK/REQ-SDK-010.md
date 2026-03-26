# REQ-SDK-010: Plugin Ecosystem Security

## Overview

Addresses 4 attack vectors against the plugin distribution and trust chain:
1. **Typosquatting** -- attacker creates similar-name repo with valid plugin.json and cosign signatures from their own CI
2. **Compromised CI** -- attacker gains write access to plugin repo; cosign signature is valid because built by legitimate repo's CI
3. **Binary tampering** -- malware modifies plugin binary after installation
4. **TOCTOU race** -- binary replaced between verification and first execution

## Specification

### Enhanced plugin.json Schema

Every plugin repo's `plugin.json` must include `author` and `security` fields:

```json
{
  "aegis-plugin": true,
  "contract": "aegis-infra/v1",
  "name": "gcp-assured-workloads",
  "description": "IL4/IL5 Assured Workloads boundary in Google Cloud",
  "binary-prefix": "gcp-assured-workloads",
  "author": {
    "org": "rtmx-ai",
    "repo": "gcp-assured-workloads",
    "oidc-issuer": "https://token.actions.githubusercontent.com"
  },
  "security": {
    "minimum-aegis-version": "0.1.0",
    "risk-classification": "CUI",
    "requires-network": ["*.googleapis.com"]
  }
}
```

The SDK provides `validatePluginManifest(json)` that validates this schema. aegis-cli calls this during `aegis plugin install` before downloading any binary.

### Binary Integrity Self-Check

The SDK provides `computeBinarySha256(filePath)` using `node:crypto`. Plugins can embed an expected hash in `PluginConfig.expectedSha256`. If set, `createPluginCli()` verifies the running binary's hash before dispatching any subcommand.

### aegis-cli Responsibilities (documented, not our implementation)

- **Trusted publisher allowlist**: `~/.aegis/trusted-publishers.json` mapping plugin names to allowed `(org, repo, oidc-issuer)` tuples
- **OIDC identity verification**: cosign signature identity must match the `author` field in `plugin.json`
- **Invocation-time tamper check**: SHA256 of binary computed before every exec(), compared to stored checksum
- **TOCTOU mitigation**: file descriptor locking -- open the binary, compute hash on the fd, exec from the same fd

## BDD Scenarios

### Scenario 1: Plugin manifest with missing author is rejected
- Given a plugin.json without the "author" field
- When validatePluginManifest is called
- Then the result contains error "author is required"

### Scenario 2: Plugin manifest with invalid OIDC issuer is rejected
- Given a plugin.json with author.oidc-issuer "http://not-github.com"
- When validatePluginManifest is called
- Then the result contains error about invalid OIDC issuer

### Scenario 3: Plugin manifest with invalid risk classification is rejected
- Given a plugin.json with security.risk-classification "UNKNOWN"
- When validatePluginManifest is called
- Then the result contains error about valid classifications

### Scenario 4: Valid plugin manifest passes validation
- Given a complete plugin.json with all security fields
- When validatePluginManifest is called
- Then validation passes with no errors

### Scenario 5: Binary integrity check fails on tampered binary
- Given a PluginConfig with expectedSha256 "abc123"
- And the actual binary hash is "def456"
- When createPluginCli runs
- Then the result event has success false with "Binary integrity check failed"

### Scenario 6: Network domain restrictions are declared
- Given a plugin.json with security.requires-network ["*.googleapis.com"]
- When validatePluginManifest is called
- Then the requires-network patterns are validated as legal domain globs

## TDD Test Signatures

- `validatePluginManifest`: Validates extended plugin.json schema (author, security fields)
- `computeBinarySha256`: Computes SHA256 of a file using node:crypto
- `integrityCheckInCreatePluginCli`: Verifies binary hash before subcommand dispatch

## Acceptance Criteria

- [AC1] validatePluginManifest rejects plugin.json missing author or security fields
- [AC2] computeBinarySha256 returns correct hash for known files
- [AC3] createPluginCli rejects startup when expectedSha256 does not match
- [AC4] All security metadata fields are documented in PLUGIN_GUIDE.md

## Traceability

- Tests: src/security/__tests__/manifest-schema.test.ts, src/security/__tests__/integrity.test.ts
- Attacks: 1 (Typosquatting), 2 (Compromised CI), 7 (Binary Tampering), 8 (TOCTOU)
