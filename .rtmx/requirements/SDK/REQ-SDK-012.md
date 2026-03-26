# REQ-SDK-012: CI Compliance Enforcement

## Overview

The SDK provides a CI compliance checker tool (`aegis-ci-check`) that validates a plugin repo's GitHub Actions workflows contain all required security steps. This enforces uniform security across the plugin ecosystem: if a plugin omits cosign signing, checksum generation, or other required steps, the check fails and the plugin cannot claim SDK compliance.

## Specification

### Required Steps in Release Workflow

The checker reads `.github/workflows/*.yml` and validates:

| Check | What It Looks For | Why Required |
|-------|-------------------|--------------|
| cosign-signing | `cosign sign-blob` in a step | Binary provenance (Attacks 1, 2) |
| checksum-generation | `sha256sum` or `shasum` in a step | Integrity verification (Attack 7) |
| version-verification | Tag-to-package.json version comparison | Prevents accidental wrong-version publish |
| binary-verification | Plugin binary `manifest` subcommand test | Ensures binary speaks the protocol |
| bundle-upload | `.bundle` files in upload-artifact | Cosign bundles must ship with binaries |
| id-token-permission | `id-token: write` in permissions | Required for OIDC-based cosign signing |

### Implementation

- `checkCiCompliance(workflowDir: string): ComplianceResult` in `src/security/ci-compliance.ts`
- Reads workflow YAML files as plain text (string pattern matching, no YAML parser dependency)
- Returns structured result: overall pass/fail, per-check pass/fail with messages
- `aegis-ci-check` CLI in `src/security/ci-compliance-cli.ts` wraps the function

### Integration into Plugin CI

Plugins add a `security-compliance` job to their CI workflow:

```yaml
security-compliance:
  name: Security Compliance
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: npx @aegis-cli/infra-sdk aegis-ci-check .github/workflows/
```

If the check fails, the CI pipeline fails, blocking the PR.

### ComplianceResult Type

```typescript
interface ComplianceCheck {
  name: string;
  passed: boolean;
  message: string;
}

interface ComplianceResult {
  overall: boolean;
  checks: ComplianceCheck[];
}
```

## BDD Scenarios

### Scenario 1: Compliant release workflow passes all checks
- Given a release workflow with cosign, sha256sum, version verify, binary verify, bundle upload, and id-token permission
- When checkCiCompliance is run
- Then overall is true and all checks pass

### Scenario 2: Missing cosign step fails
- Given a release workflow without cosign sign-blob
- When checkCiCompliance is run
- Then overall is false
- And the cosign-signing check fails with "Release workflow must include cosign sign-blob step"

### Scenario 3: Missing checksum generation fails
- Given a release workflow with cosign but no sha256sum
- When checkCiCompliance is run
- Then overall is false and checksum-generation check fails

### Scenario 4: Missing id-token permission fails
- Given a release workflow without id-token: write
- When checkCiCompliance is run
- Then overall is false and id-token-permission check fails

### Scenario 5: Missing workflow directory handled gracefully
- Given a nonexistent directory path
- When checkCiCompliance is run
- Then overall is false with error about missing directory

### Scenario 6: CI workflow without release workflow is flagged
- Given only a ci.yml with no release.yml
- When checkCiCompliance is run
- Then overall is false with "No release workflow found"

## TDD Test Signatures

- `checkCiCompliance`: Validates workflow directory against required steps
- `aegis-ci-check CLI`: Wraps function with process.argv and exit codes

## Acceptance Criteria

- [AC1] Compliant workflow passes all 6 checks
- [AC2] Each missing step produces a specific, actionable error message
- [AC3] The checker uses string pattern matching (no YAML parser dependency)
- [AC4] aegis-ci-check CLI exits 0 on pass, 1 on fail
- [AC5] Plugin CI includes the compliance check as a required job

## Traceability

- Tests: src/security/__tests__/ci-compliance.test.ts
- Tool: src/security/ci-compliance-cli.ts (bin: aegis-ci-check)
