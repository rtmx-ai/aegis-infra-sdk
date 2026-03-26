# REQ-SDK-011: Runtime Security Boundaries

## Overview

Addresses 3 attack vectors at execution time:
1. **Output injection** -- malicious plugin returns crafted outputs (e.g., vertex_endpoint pointing to attacker proxy). aegis-cli writes to config without validation.
2. **SDK supply chain** -- compromised npm package via semver range auto-update
3. **Token exfiltration via health check** -- health check sends ADC token to external endpoint

## Specification

### Output Value Validation Framework

`PluginConfig` gains an optional `outputValidation` field:

```typescript
outputValidation?: Record<string, RegExp>;
```

After `engine.up()` returns, the SDK validates each output value against its pattern. If any output fails validation, the result event reports failure and the malicious output is never emitted.

Example for GCP plugin:
```typescript
outputValidation: {
  vertex_endpoint: /^[a-z0-9-]+-aiplatform\.googleapis\.com$/,
  kms_key_resource_name: /^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/keyRings\/.+\/cryptoKeys\/.+$/,
  perimeter_configured: /^(true|false)$/,
}
```

Implementation: `validateOutputValues(outputs, patterns)` in `src/security/output-validation.ts`. Pure function, no I/O.

### SDK Version Pinning Enforcement

`validateSdkPinning(packageJson)` in `src/security/dependency-check.ts` verifies the `@aegis-cli/infra-sdk` dependency uses an exact version (no `^`, `~`, `*`, or range operators). Used by the CI compliance checker (REQ-SDK-012).

This prevents Attack 5: a compromised SDK patch version auto-installed via `^0.1.0`.

### Domain Allowlist (Plugin-Side)

The plugin's `fetchWithRetry` gains an `allowedDomains` parameter. Health checks that construct URLs must go through this allowlist. A compromised health check that attempts to POST the ADC token to `attacker.com` is blocked before any network call.

This is plugin-side code (not SDK) because the SDK has zero I/O dependencies.

### Scoped Tokens (Plugin-Side)

The plugin's `getAdcToken()` gains an optional `scope` parameter. Health checks use `cloud-platform.read-only`; only engine operations use the full `cloud-platform` scope. This limits the blast radius of token exfiltration: a stolen read-only token cannot modify resources.

## BDD Scenarios

### Scenario 1: Malicious output is blocked
- Given outputValidation with vertex_endpoint pattern matching only *.googleapis.com
- And engine.up() returns vertex_endpoint "attacker-proxy.evil.com"
- When the up subcommand completes
- Then the result has success false with "Output validation failed"
- And the malicious endpoint is never in the result outputs

### Scenario 2: Valid outputs pass validation
- Given the same outputValidation pattern
- And engine.up() returns vertex_endpoint "us-central1-aiplatform.googleapis.com"
- When the up subcommand completes
- Then the result has success true with correct outputs

### Scenario 3: SDK semver range is rejected
- Given a package.json with "@aegis-cli/infra-sdk": "^0.1.0"
- When validateSdkPinning is called
- Then the result is invalid with "must use exact version pinning"

### Scenario 4: Exact SDK version is accepted
- Given a package.json with "@aegis-cli/infra-sdk": "0.1.0"
- When validateSdkPinning is called
- Then the result is valid

### Scenario 5: Non-allowlisted domain is blocked
- Given fetchWithRetry configured with allowedDomains ["*.googleapis.com"]
- When a health check fetches "https://attacker.com/exfil"
- Then the call throws "Domain not in allowlist"
- And no HTTP request is made

### Scenario 6: Scoped token limits health check permissions
- Given getAdcToken called with scope "cloud-platform.read-only"
- When the token is used for a health check
- Then the token has read-only scope

## TDD Test Signatures

- `validateOutputValues`: Validates output values against regex patterns
- `validateSdkPinning`: Checks package.json for exact version pinning
- Domain allowlist tests in plugin's fetch-retry.test.ts
- Scoped token tests in plugin's token-cache tests

## Acceptance Criteria

- [AC1] Malicious outputs are blocked before emission to stdout
- [AC2] Valid outputs pass through unchanged
- [AC3] SDK semver ranges are rejected by the compliance checker
- [AC4] Health checks cannot fetch non-allowlisted domains
- [AC5] Health check tokens are scoped to read-only

## Traceability

- Tests: src/security/__tests__/output-validation.test.ts, src/security/__tests__/dependency-check.test.ts
- Attacks: 3 (Output Injection), 5 (SDK Supply Chain), 6 (Token Exfiltration)
