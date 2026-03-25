# REQ-SDK-002: Plugin Developer Best Practices

## Overview

The SDK must codify the 10 best practices identified during the gcp-cui-gemini PoC into enforceable conventions. These practices are not suggestions -- they are the contract between a plugin and aegis-cli. Plugins that violate them will produce incorrect protocol output, false health assurance, or credential leaks.

## Specification

### The 10 Best Practices

**1. Three files, three concerns.**
A plugin has exactly three implementation files beyond the entrypoint:
- `csp-client.ts` -- credential validation, API readiness, API enablement
- `engine.ts` -- IaC provisioning
- `health.ts` -- boundary health checks

**2. The entrypoint is declarative.**
`index.ts` is a single `createPluginCli()` call. No imperative logic, no switch statements, no process.argv handling.

**3. Health checks must fail honest.**
Every check distinguishes pass (verified working), fail (verified broken with actionable detail), warn (cannot determine). Never treat 401/403 as pass. Never silently skip a check.

**4. Outputs are routing metadata, never secrets.**
Outputs contain endpoint URLs, resource names, configuration flags. Never API keys, tokens, or credential material.

**5. Every resource gets compliance labels/tags.**
All resources tagged with: `aegis-managed: true`, impact level, compliance framework.

**6. CSP client methods are individually testable.**
Each method makes one API call. Live client is a thin REST wrapper. Business logic stays in the SDK.

**7. Health checks accept outputs.**
Every check function takes `(config, outputs?)` to use actual provisioned resource names, not hardcoded guesses.

**8. Engine operations are idempotent.**
`up` x 2 = same result. `destroy` on empty = no-op. `preview` never mutates.

**9. Required APIs are declared, not discovered.**
`PluginConfig.requiredApis` lists them. The SDK handles enablement. Plugins never call enablement APIs directly.

**10. Plugin-specific warnings go in health checks, not provisioning.**
VERIFY is the single source of truth for boundary status. PROVISION emits only progress events.

## BDD Scenarios

### Scenario 1: Entrypoint is a single function call
- Given a plugin following best practices
- When index.ts is inspected
- Then it contains a single createPluginCli() call
- And no switch statements, process.argv access, or event emission

### Scenario 2: Health check never returns pass for auth errors
- Given an API returning HTTP 403
- When the health check processes the response
- Then the check status is "fail" or "warn", never "pass"

### Scenario 3: Stack outputs contain no secrets
- Given a provisioned boundary
- When stack outputs are inspected
- Then no output value contains a token, key, or credential

### Scenario 4: All resources have compliance tags
- Given a provisioned boundary
- When resources are inspected
- Then every taggable resource has aegis-managed, impact-level, and compliance-framework labels

## Acceptance Criteria

- [AC1] All 10 practices are documented in PLUGIN_GUIDE.md with examples
- [AC2] The exemplar plugin demonstrates all 10 practices
- [AC3] The SDK enforces practices 2, 4, 9, 10 structurally (plugin author cannot violate them)
- [AC4] Practices 1, 3, 5, 6, 7, 8 are convention-enforced via guide and code review

## Traceability

- Docs: PLUGIN_GUIDE.md
- Exemplar: gcp-assured-workloads (renamed from gcp-cui-gemini)
